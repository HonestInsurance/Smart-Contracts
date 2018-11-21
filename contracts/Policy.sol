/**
 * @description Policy contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.24;

import "./Lib.sol";
import "./Pool.sol";
import "./SetupI.sol";
import "./Bank.sol";
import "./HashMapI.sol";
import "./Adjustor.sol";
import "./IntAccessI.sol";
import "./NotificationI.sol";
import "./Timer.sol";


/** @title Policy contract insurance consumers.*/
contract Policy is SetupI, IntAccessI, NotificationI, HashMapI {
    
    struct PolicyData {
        // Index of this Policy
        uint idx;
        // Access key / password of the Bond owner
        address owner;
        // Bank payment hash as provided by the bank
        bytes32 paymentAccountHash;

         // Policy document hash
        bytes32 documentHash;
        // Risk points associated with this policy
        uint riskPoints;

        // Total premium payments made by the policy owner
        uint premiumCredited_Cu;
        // Total premium this policy has been changed by the pool
        uint premiumCharged_Cu_Ppt;

        // Different states a Bond can be in 
        Lib.PolicyState state;

        // The days to perform the reconciliation process
        uint lastReconciliationDay;
        uint nextReconciliationDay;
    }

    // The number of total policy risk points / sum of all policies in Issued state
    uint public totalIssuedPolicyRiskPoints = 0;
    // Save the current pool day
    uint public currentPoolDay = 0;

    // Storage mapping for all the bond data Hash of the Bond points to its data
    mapping(bytes32 => PolicyData) public dataStorage;

    // Mapping to store the risk premiums charged by the pool per risk point (current day => # cummulated days back => premium)
    mapping(uint => mapping(uint => uint)) public premiumPerRiskPoint_Cu_Ppm;

    // Events broadcasted by the Bond / Log events
    event LogPolicy(bytes32 indexed policyHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);

    /**@dev Constructor of the  Bond.
     * @param _trustAdr The address of the Trust.
     */
    constructor(address _trustAdr) IntAccessI(_trustAdr) public {
    }

    /**
    * @dev Modifier verifies if the Adjustor hash and signing private key and the adjustor's policy risk point limit are sufficient
    */
    modifier isAdjustorPolicyPermissioned(bytes32 _adjustorHash, uint _riskPoints) {
        require(
            Adjustor(getAdjustorAdr()).isAdjustorPolicyPermissioned(_adjustorHash, msg.sender, _riskPoints) == true,
            "Adjustor has insufficient privileges"
            );
        _;
    }

    /**@dev Creates an new policy
     * @param _adjustorHash The hash of the adjustor creating this policy
     * @param _owner The address of the policy owner. This must be an externally owned account and not a contract address!
     * @param _documentHash The hash of the policy document
     * @param _riskPoints The risk points associated with this policy
     */
    function createPolicy(bytes32 _adjustorHash, address _owner, bytes32 _documentHash, uint _riskPoints) 
        public
        isNotContractAdr(_owner)
        isAdjustorPolicyPermissioned(_adjustorHash, _riskPoints)
    {
        // Ensure valid parameter have been provided
        require(_owner != 0x0, "Invalid owner's address");
        require(_documentHash != 0x0, "Invalid policy document hash");
        require(_riskPoints > 0, "Invalid policy risk points amount");

        // Create a new Policy hash by using random input parameters (Timestamp, nextIdx of the PolicyHashMapping)
        bytes32 policyHash = keccak256(abi.encodePacked(hashMap.nextIdx, address(this), _owner));

        // Add the policy data to the data storage
        dataStorage[policyHash] = PolicyData({
            // Specify the hashMap.nextIdx as the index for this new policy
            idx: hashMap.nextIdx,
            // Save the address of the policy's owner
            owner: _owner,
            // Set the policy document hash
            documentHash: _documentHash,
            // Set the policy risk points
            riskPoints: _riskPoints,
            // Set the policy's preliminary maturity date (this will be overwritten later)
            premiumCredited_Cu: 0,
            premiumCharged_Cu_Ppt: 0,
            // Set the policys status to created
            state: Lib.PolicyState.Paused,
            // Set the remaining policy variables to 0 or 0x0
            paymentAccountHash: bytes32(0x0),
            // Set the last reconciliation day to today
            lastReconciliationDay: currentPoolDay,
            // Set the next reconciliation day to max duration in the future
            nextReconciliationDay: currentPoolDay + MAX_DURATION_POLICY_PAUSED_DAY
        });

        // Add the policy to the Hash map
        hashMap.add(policyHash);

        // Add log entry to document creation of the policy (document policy hash and risk points)
        emit LogPolicy(policyHash, _owner, bytes32(_riskPoints), now, uint(dataStorage[policyHash].state));
        emit LogPolicy(policyHash, _owner, bytes32(_documentHash), now, uint(dataStorage[policyHash].state));
    }

    /**@dev Updates an existing policy
     * @param _adjustorHash The hash of the adjustor creating this policy
     * @param _policyHash The hash of the policy to update
     * @param _documentHash The new hash of the policy document
     * @param _riskPoints The new risk points associated with this policy
     */
    function updatePolicy(bytes32 _adjustorHash, bytes32 _policyHash, bytes32 _documentHash, uint _riskPoints) 
        public
        isAdjustorPolicyPermissioned(_adjustorHash, _riskPoints)
    {
        // Ensure valid parameter have been provided
        require(_documentHash != 0x0, "Invalid policy document hash");
        require(_riskPoints > 0, "Invalid policy risk points amount");
        // Ensure the policy is a valid and active policy
        require(isActive(_policyHash) == true, "Invalid policy hash");

        if (dataStorage[_policyHash].state == Lib.PolicyState.Issued) {
            // Reconcile the policy and ensure the policy is still in an Issued state
            require(reconcilePolicy(_policyHash) == Lib.PolicyState.Issued, "Invalid policy status");

            // Adjust the total issued policy risk points
            totalIssuedPolicyRiskPoints = totalIssuedPolicyRiskPoints + _riskPoints - dataStorage[_policyHash].riskPoints;

            // Update the policy data
            dataStorage[_policyHash].documentHash = _documentHash;
            dataStorage[_policyHash].riskPoints = _riskPoints;

            // Add log entry to document creation of the policy (document policy hash and risk points)
            emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, bytes32(_riskPoints), now, uint(dataStorage[_policyHash].state));
            emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, bytes32(_documentHash), now, uint(dataStorage[_policyHash].state));

            // Calculate the next reconciliation day
            uint nextDay = calculateNextReconciliationDay(_policyHash);
            // If the next reconciliation day is 0 (insufficient funds revert the entire policy update)
            require(nextDay > 0, "Policy has insufficient funds");
            // Save the next reconciliation day
            dataStorage[_policyHash].nextReconciliationDay = nextDay;
        } else {
            // Update the policy data
            dataStorage[_policyHash].documentHash = _documentHash;
            dataStorage[_policyHash].riskPoints = _riskPoints;

            // Add log entry to document creation of the policy (document policy hash and risk points)
            emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, bytes32(_riskPoints), now, uint(dataStorage[_policyHash].state));
            emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, bytes32(_documentHash), now, uint(dataStorage[_policyHash].state));
        }
    }

    /**@dev Function is called by the Insurance Pool, when a policy holder made a deposit and it
            has been credited to the insurance pool's Premium Account.
     * @param _paymentAccountHash The payment account hash of the sender used for this bank payment.
     * @param _paymentSubject Payment particular/code/reference to be specified for the bank transaction
     * @param _creditAmount_Cu The amount that has been credited to the Premium Account.
     * @return info describing an unsuccessfull funding otherwise empty (0x0)
     */
    function processAccountCredit(bytes32 _paymentAccountHash, bytes32 _paymentSubject, uint _creditAmount_Cu)
        public
        isIntAuth
        returns (bool success, bytes32 info, bytes32 policyHash)
    {
         // Verify if the paymentSubject provided matches the any of the Policy hashes
        if (dataStorage[_paymentSubject].owner != 0x0)
            policyHash = _paymentSubject;
        else 
            return (false, bytes32("PaymentSubject"), 0x0);

        // Verify if the policy is not in a Retired state
        if (dataStorage[policyHash].state == Lib.PolicyState.Retired)
            return (false, bytes32("PolicyState"), 0x0);
        
        // Verify the amount credited is between min and max amount
        if ((_creditAmount_Cu < Pool(getPoolAdr()).MIN_POLICY_CREDIT_CU()) ||
            (_creditAmount_Cu > Pool(getPoolAdr()).MAX_POLICY_CREDIT_CU()))
            return (false, bytes32("CreditAmount"), 0x0);

        // Verify the payment account hash is valid in case previous premium payments have alredy been made
        if ((dataStorage[policyHash].premiumCredited_Cu > 0) && 
            (dataStorage[policyHash].paymentAccountHash != _paymentAccountHash))
            return (false, bytes32("PaymentAccountHash"), 0x0);
        
        // If the policy is in an issued state or policy is in a PostedLapsed state or policy is in a paused state but has previously already received payments
        if ((dataStorage[policyHash].state == Lib.PolicyState.Issued) ||
            (dataStorage[policyHash].state == Lib.PolicyState.PostLapsed) || 
            ((dataStorage[policyHash].state == Lib.PolicyState.Paused) && (dataStorage[policyHash].premiumCredited_Cu > 0)))
        {
            // Credit the amount to the policy
            dataStorage[policyHash].premiumCredited_Cu += _creditAmount_Cu;

            // If policy is in an issued state potentially perform a reconciliation
            if (dataStorage[policyHash].state == Lib.PolicyState.Issued) {
                // Check if it is safe to perform a policy reconciliation - one that would not require a change of the policy's state
                if (calculateNextReconciliationDay(policyHash) != 0) {
                    reconcilePolicy(policyHash);
                }
            }

        // If policy is in a paused state and this is the first premium payment being received
        } else if ((dataStorage[policyHash].state == Lib.PolicyState.Paused) && 
            (dataStorage[policyHash].premiumCredited_Cu == 0))
        {
            // Set the payment Account hash
            dataStorage[policyHash].paymentAccountHash = _paymentAccountHash;
            // Credit the amount to the policy
            dataStorage[policyHash].premiumCredited_Cu += _creditAmount_Cu;

            // Calculate the next reconciliation day
            dataStorage[policyHash].nextReconciliationDay = calculateNextReconciliationDay(policyHash);
            // Verify if sufficient funds have been credited and a future reconciliation day has been specified
            if (dataStorage[policyHash].nextReconciliationDay > 0) {
                // Set the last reconciliation day to today (starting point of the policy)
                dataStorage[policyHash].lastReconciliationDay = currentPoolDay;
                // Change the policies status to Issued
                dataStorage[policyHash].state = Lib.PolicyState.Issued;
                // Add the policy risk points
                totalIssuedPolicyRiskPoints += dataStorage[policyHash].riskPoints;
                // Add log entry
                emit LogPolicy(policyHash, dataStorage[policyHash].owner, 0x0, now, uint(dataStorage[policyHash].state));
            }

        // If policy is in a lapsed state
        } else if (dataStorage[policyHash].state == Lib.PolicyState.Lapsed) {
            // In case this is the first premium payment being received
            if (dataStorage[policyHash].premiumCredited_Cu == 0) {
                // Set the payment Account hash
                dataStorage[policyHash].paymentAccountHash = _paymentAccountHash;
            }

            // Credit the amount to the policy
            dataStorage[policyHash].premiumCredited_Cu += _creditAmount_Cu;

            // Calculate the next reconciliation day
            dataStorage[policyHash].nextReconciliationDay = calculateNextReconciliationDay(policyHash);
            // Verify if sufficient funds have been credited (next reconciliation day is sufficiently in the future)
            if (dataStorage[policyHash].nextReconciliationDay > currentPoolDay + DURATION_POLICY_POST_LAPSED_DAY) {
                // Set the next reconciliation day to the time when the policy should change to issued state
                dataStorage[policyHash].nextReconciliationDay = currentPoolDay + DURATION_POLICY_POST_LAPSED_DAY;
                // Set the last reconciliation day to today (starting point of the policy)
                dataStorage[policyHash].lastReconciliationDay = currentPoolDay;
                // Change the policies status to Issued
                dataStorage[policyHash].state = Lib.PolicyState.PostLapsed;
                // Add log entry
                emit LogPolicy(policyHash, dataStorage[policyHash].owner, 0x0, now, uint(dataStorage[policyHash].state));
            }
            // In case insufficient funds have been credited to allow state to change set next reconciliation day to 0
            else dataStorage[policyHash].nextReconciliationDay = 0;
        }
        // Return a positive result
        return (true, 0x0, policyHash);
    }

    /**@dev Function is called by the owner of a policy to temporarily suspend the policy
     * @param _policyHash The hash of the policy that should be suspended
     */
    function suspendPolicy(bytes32 _policyHash) public {
        // Ensure the sender of the transaction is the owner of the policy
        require(dataStorage[_policyHash].owner == msg.sender, "Invalid authorisation");

        // Ensure the policy is in an Issued state
        require(dataStorage[_policyHash].state == Lib.PolicyState.Issued, "Invalid policy status");

        // Reconcile this policy (Note: The 'new' state of the policy returned as part of this reconciliation
        // is ignored (even if 'should' be changed to Lapsed because of insufficient funds)
        reconcilePolicy(_policyHash);

        // Change the policy state to Paused
        dataStorage[_policyHash].state = Lib.PolicyState.Paused;

        // Remove the policy risk points
        totalIssuedPolicyRiskPoints -= dataStorage[_policyHash].riskPoints;

        // Set the next reconciliation day to the max duration this policy is allowed to remain in paused state
        dataStorage[_policyHash].nextReconciliationDay = currentPoolDay + MAX_DURATION_POLICY_PAUSED_DAY;

        // Add log entry
        emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, 0x0, now, uint(dataStorage[_policyHash].state));
    }

    /**@dev Function is called by the owner of a policy to re-issue a previously suspend the policy
     * @param _policyHash The hash of the policy that should be re-issued
     */
    function unsuspendPolicy(bytes32 _policyHash) public {
        // Ensure the sender of the transaction is the owner of the policy
        require(dataStorage[_policyHash].owner == msg.sender, "Invalid authorisation");

        // Ensure the policy is in a Paused state
        require(dataStorage[_policyHash].state == Lib.PolicyState.Paused, "Invalid policy status");

        // Ensure the policy is in between the minimum and maximum policy paused duration
        require(dataStorage[_policyHash].lastReconciliationDay + MIN_DURATION_POLICY_PAUSED_DAY <= currentPoolDay, "Policy not long enough in paused status");
        require(dataStorage[_policyHash].lastReconciliationDay + MAX_DURATION_POLICY_PAUSED_DAY >= currentPoolDay, "Policy too long in paused status");

        // Get the next reconciliation day
        uint nextReconciliationDay = calculateNextReconciliationDay(_policyHash);

        // Ensure sufficient funds are available to pay for todays premium by check if the provided next day is in the future and not 0
        require(nextReconciliationDay != 0, "Policy has insufficient funds");

        // Set the last and next reconciliation day
        dataStorage[_policyHash].lastReconciliationDay = currentPoolDay;
        dataStorage[_policyHash].nextReconciliationDay = nextReconciliationDay;

        // Change the policy state to Issued
        dataStorage[_policyHash].state = Lib.PolicyState.Issued;

        // Add the policy risk points
        totalIssuedPolicyRiskPoints += dataStorage[_policyHash].riskPoints;

        // Add log entry
        emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, 0x0, now, uint(dataStorage[_policyHash].state));
    }

    /**@dev This function can only be called by the owner of the policy or the policy contract itself (this)
     * @param _policyHash The hash of the policy that should be retired
     */
    function retirePolicy(bytes32 _policyHash) public {
        // If the caller of this function is not the policy contract itself
        if (msg.sender != address(this)) {
            // Ensure the caller of the transaction is the owner of the policy
            require(dataStorage[_policyHash].owner == msg.sender, "Invalid authorisation");
        }
        // Ensure the policy is either in an Issued or Lapsed state
        require(
            (dataStorage[_policyHash].state == Lib.PolicyState.Issued) || 
            (dataStorage[_policyHash].state == Lib.PolicyState.Lapsed),
            "Invalid policy status"
            );

        // If Policy is in an issued state reconcile the policy a last time and remove the risk points
        if (dataStorage[_policyHash].state == Lib.PolicyState.Issued) {
            // Reconcile the policy
            reconcilePolicy(_policyHash);
            // Remove the policy risk points
            totalIssuedPolicyRiskPoints -= dataStorage[_policyHash].riskPoints;
        }
        // Set the last and next reconciliation day
        dataStorage[_policyHash].lastReconciliationDay = currentPoolDay;
        dataStorage[_policyHash].nextReconciliationDay = 0;
        // Change the policy state to Retired
        dataStorage[_policyHash].state = Lib.PolicyState.Retired;
        // Refund the oustanding policy owner's account balance from the Premium Holding account by creating a payment advice
        
        uint refundAmount = dataStorage[_policyHash].premiumCredited_Cu - (dataStorage[_policyHash].premiumCharged_Cu_Ppt / 10**3);
        // If the refund amount is greater than 0 then create a bank payment advice
        if (refundAmount > 0) {
            // Create payment instruction for the bank
            Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.PremiumRefund, 
                dataStorage[_policyHash].paymentAccountHash, _policyHash, refundAmount, _policyHash);
        }

        // Archive the policy
        hashMap.archive(_policyHash);
        // Add log entry
        emit LogPolicy(_policyHash, dataStorage[_policyHash].owner, 0x0, now, uint(dataStorage[_policyHash].state));
    }

    function processPolicy(bytes32 _message) private {
        uint currentPolicyIdx = uint(_message);
        // Extract the next policy id to be processed from _message
        uint gasProcessIterations = 0;
        // temp variable for the policy hash
        bytes32 pHash;

        // If a value of 0 has been provided as the first policy idx to process set the first policy to process to the
        // first active policy according to the hash map.
        if (currentPolicyIdx == 0)
            currentPolicyIdx = hashMap.firstIdx;

        for (; (currentPolicyIdx < hashMap.nextIdx) && (gasProcessIterations < 1000); currentPolicyIdx++) {
            // Increase the gas counter by 1
            gasProcessIterations++;
            // Get the hash of the current policy
            pHash = hashMap.get(currentPolicyIdx);

            // Verify if the policy needs to be processed by comparing today's with the policy's nextReconciliationDay
            if (currentPoolDay == dataStorage[pHash].nextReconciliationDay) {
                // Increase the gas counter by 10 since this is an gas expensive policy to process 
                gasProcessIterations += 10;
                // ******************************************************************
                // POLICY STATE: Issued   ==>   New State: Issued|Lapsed
                // ******************************************************************
                if (dataStorage[pHash].state == Lib.PolicyState.Issued) {
                    // Reconcile the policy and verify if the new state returned is Lapsed (due to insufficient funds)
                    if (reconcilePolicy(pHash) == Lib.PolicyState.Lapsed) {
                        // Change the policy state to Lapsed
                        dataStorage[pHash].state = Lib.PolicyState.Lapsed;
                        // Remove the policy risk points
                        totalIssuedPolicyRiskPoints -= dataStorage[pHash].riskPoints;
                        // Create a log entry to document the change of the policy's state
                        emit LogPolicy(pHash, dataStorage[pHash].owner, 0x0, now, uint(dataStorage[pHash].state));
                    }

                // ******************************************************************
                // POLICY STATE: Paused   ==>   New State: Lapsed
                // ******************************************************************
                } else if (dataStorage[pHash].state == Lib.PolicyState.Paused) {
                    // Change the policy state to Lapsed
                    dataStorage[pHash].state = Lib.PolicyState.Lapsed;
                    // Set the last and next reconciliation day
                    dataStorage[pHash].lastReconciliationDay = currentPoolDay;
                    dataStorage[pHash].nextReconciliationDay = currentPoolDay + MAX_DURATION_POLICY_LAPSED_DAY;
                    // Create a log entry to document the change of the policy's state
                    emit LogPolicy(pHash, dataStorage[pHash].owner, 0x0, now, uint(dataStorage[pHash].state));      
                
                // ******************************************************************
                // POLICY STATE: PostLapsed   ==>   New State: Issued
                // ******************************************************************
                } else if (dataStorage[pHash].state == Lib.PolicyState.PostLapsed) {
                    // Change the policy state to Issued
                    dataStorage[pHash].state = Lib.PolicyState.Issued;
                    // Add the policy risk points
                    totalIssuedPolicyRiskPoints += dataStorage[pHash].riskPoints;
                    // Set the last and next reconciliation day
                    dataStorage[pHash].lastReconciliationDay = currentPoolDay;
                    dataStorage[pHash].nextReconciliationDay = calculateNextReconciliationDay(pHash);
                    // Create a log entry to document the change of the policy's state
                    emit LogPolicy(pHash, dataStorage[pHash].owner, 0x0, now, uint(dataStorage[pHash].state));

                // ******************************************************************
                // POLICY STATE: Lapsed   ==>   New State: Retired
                // ******************************************************************
                } else if (dataStorage[pHash].state == Lib.PolicyState.Lapsed) {
                    // Perform an external call of this function so that the function 'retirePolicy' can verify the 
                    // caller as the policy contract itself
                    this.retirePolicy(pHash);
                }
            }
        }

        // Book a new timer notification to process the next batch of policies in 5 min from now if required
        if (currentPolicyIdx != hashMap.nextIdx) {
            Timer(getTimerAdr()).addNotification(now + 300, uint8(NotificationSubject.PolicyProcessing),
                bytes32(currentPolicyIdx), address(this));
        }
    }

    /**@dev Function performs the process of reconciling a policy (Note: The policy is not being 'charged' for today's premium (only historic days))
     * @param _policyHash The hash of the policy that should be reconciled
     * @return newState The policy's new state after the reconciliation has been completed
     */
    function reconcilePolicy(bytes32 _policyHash) private returns (Lib.PolicyState newState) {
        // Ensure the policy is in an issued state
        require(dataStorage[_policyHash].state == Lib.PolicyState.Issued, "Policy status invalid");
        // Calculate the number of days since last reconciliation (Note: Today must not be reconciled - only past days!!!)
        uint totalDays = currentPoolDay - dataStorage[_policyHash].lastReconciliationDay;
        // Only adjust the premiums charged if the total days to reconcile is greater than 0
        if (totalDays > 0)
            dataStorage[_policyHash].premiumCharged_Cu_Ppt += (dataStorage[_policyHash].riskPoints * premiumPerRiskPoint_Cu_Ppm[currentPoolDay][totalDays] / (10**3));
        // Set the last reconciliation day to today
        dataStorage[_policyHash].lastReconciliationDay = currentPoolDay;
        // Calculate the ideal next reconciliation day in the future
        dataStorage[_policyHash].nextReconciliationDay = calculateNextReconciliationDay(_policyHash);
        // Verify if the nextReconciliationDay calculated is 0 (Policy's state may be changed to Lapsed)
        if (dataStorage[_policyHash].nextReconciliationDay == 0) {
            // Set the next reconciliation to the max duration the policy is allowed to remain in a lapsed state
            dataStorage[_policyHash].nextReconciliationDay = currentPoolDay + MAX_DURATION_POLICY_LAPSED_DAY;
            // Return the new state of Lapsed
            return Lib.PolicyState.Lapsed;
        }
        return Lib.PolicyState.Issued;
    }

    /**@dev Function calculates the ideal day in the future to reconcile this policy again
     * @param _policyHash The hash of the policy that should be considered
     * @return nextRecDay Is 0 if insufficient funds are availalbe even for the current day otherwise the next pool day
     */
    function calculateNextReconciliationDay(bytes32 _policyHash)
        private 
        view 
        returns (uint nextRecDay)
    {
        // Calculate the remaining funds for this policy
        uint funds_Cu_Ppt = (dataStorage[_policyHash].premiumCredited_Cu * (10**3)) - dataStorage[_policyHash].premiumCharged_Cu_Ppt;
        // Calculate the premium charged for the current pool day for this policy 
        uint costPerDay_Cu_Ppt = (premiumPerRiskPoint_Cu_Ppm[currentPoolDay][0] * dataStorage[_policyHash].riskPoints) / (10**3);
        // If the remaining funds for this policy are insufficient to cover today's premium return 0
        if (costPerDay_Cu_Ppt > funds_Cu_Ppt)
            return 0;
        // If the costsPerDay are 0 return the next reconciliation day of tomorrow
        if (costPerDay_Cu_Ppt == 0)
            return currentPoolDay + 1;
        // Calculate the ideal next reconciliation day with safety margin
        uint futureDays = (funds_Cu_Ppt / (POLICY_RECONCILIATION_SAFETY_MARGIN * costPerDay_Cu_Ppt));
        if (futureDays < 100) {
            return currentPoolDay + 1 + futureDays;
        } else { 
            return currentPoolDay + MAX_DURATION_POLICY_RECONCILIATION_DAYS;
        }
    }

    /**@dev Sets the premium per risk point for all the policies for the specified day 
     * @param _premiumPerRiskPoint The premium amount a policy is chared for the current day per risk point
     * @param _currentPoolDay The current day to store the risk premium for
     */
    function setPremiumPerRiskPoint(uint _premiumPerRiskPoint, uint _currentPoolDay)
        public
        isPoolAuth
    {
        // Save the new currentPoolDay
        currentPoolDay = _currentPoolDay;
        // Ensure that this function can only be called once for a particular day by the pool by checking if the current pool day's risk point premium is still 0
        assert(premiumPerRiskPoint_Cu_Ppm[currentPoolDay][0] == 0);
        // Save premium per risk point as calculated for today
        premiumPerRiskPoint_Cu_Ppm[currentPoolDay][0] = _premiumPerRiskPoint;
        // Save premium per risk point for 1 day (only yesterday)
        premiumPerRiskPoint_Cu_Ppm[currentPoolDay][1] = premiumPerRiskPoint_Cu_Ppm[currentPoolDay - 1][0];
        // Iterate and calculate the risk points for any number of days for reconciliation
        for (uint i = 2; i<=MAX_DURATION_POLICY_RECONCILIATION_DAYS; i++) {
            // Calculate the historic cummulated premiums per risk points over the past days (copy of yesterday's history + new premium for today)
            premiumPerRiskPoint_Cu_Ppm[currentPoolDay][i] = premiumPerRiskPoint_Cu_Ppm[currentPoolDay - 1][i-1] + premiumPerRiskPoint_Cu_Ppm[currentPoolDay][1];
        }
    }
    
    /**@dev Executes on a ping notification initiated by the Timer
     * @param _subject The subject of the ping notifiction
     * @param _message The message of the ping notifiction
     * @param _scheduledDateTime The time the notification was scheduled for
     * @return The delta time in seconds to add to _dateTime to re-schedule the next ping; 0 for no re-scheduling.
     */
    function ping(uint8 _subject, bytes32 _message, uint _scheduledDateTime)
        external
        isTimerAuth
        returns (uint)
    {
        // To avoid warning message of unused local variable of _scheduledDateTime perform a 'dummy' assertation
        assert(_scheduledDateTime >= 0);
        // Check if the notification subject is PolicyProcessing
        if (_subject == uint8(NotificationSubject.PolicyProcessing)) {
            processPolicy(_message);
        }
        return 0;
    }

    // *******************************
    // Policy enums and structs
    // *******************************

    // Enum of the diffent Notification subjects of the pool
    enum NotificationSubject {
        /*0*/ PolicyProcessing
    }
}