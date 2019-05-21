/**
 * @description Bond contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.5.7;

import "./Lib.sol";
import "./Pool.sol";
import "./Bank.sol";
import "./SetupI.sol";
import "./IntAccessI.sol";
import "./HashMapI.sol";
import "./NotificationI.sol";
import "./Timer.sol";


/** @title Bond contract for liquidity providers.*/
contract Bond is SetupI, IntAccessI, NotificationI, HashMapI {

    struct BondData {
        // Index of this Bond
        uint idx;
        // Access key / password of the Bond owner
        address owner;
        // Bank payment hash as provided by the bank
        bytes32 paymentAccountHash;

        // Variables for the bond as per whitepaper
        uint principal_Cu;
        uint yield_Ppb;
        uint maturityPayoutAmount_Cu;
        
        // DateTime stamps for the bond
        uint creationDate;
        uint nextStateExpiryDate;
        uint maturityDate;
        
        // Different states a Bond can be in
        Lib.BondState state;

        // Used to store:  => the address of the bond that was used as a security this bond if applicable
        //                 => AND the address of another bond this bond acts a security for.
        bytes32 securityReferenceHash;
    }

    // Storage mapping for all the bond data Hash of the Bond points to its data
    mapping(bytes32 => BondData) public dataStorage;

    // Store the bond maturity payout amounts for each pool day
    mapping(uint => uint) public bondMaturityPayoutAmount;

    // Events broadcasted by the Bond / Log events
    event LogBond(bytes32 indexed bondHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);

    /**@dev Constructor of the Bond.
     * @param _trustAdr The address of the Trust.
     */
    constructor(address _trustAdr) IntAccessI(_trustAdr) public {
    }

    /**@dev Creates an new bond with the requested principal amount in a created state. The transaction (msg.sender) must be an externally owned account (not a contract address)
     * @param _principal_Cu The principal amount of the Bond.
     * @param _hashOfReferenceBond Optional parameter with the hash of an existing bond owned by the same person who is submitting this transaction
     */
    function createBond(uint _principal_Cu, bytes32 _hashOfReferenceBond)
        public
        isNotContractAdr(msg.sender)
    {
        // Ensure bond principal is in between the min and max boundaries
        require(_principal_Cu >= MIN_BOND_PRINCIPAL_CU, "Bond principal too low");
        require(_principal_Cu <= MAX_BOND_PRINCIPAL_CU, "Bond principal too high");

        // Ensure sufficient IPBs are avaialble for the new bond (this is only a preliminary check)
        require(_principal_Cu <= Pool(getPoolAdr()).WC_Bond_Cu(), "Requested bond principal exceeds availability");

        // In case a hash to provide a security for the newly created bond is provided verify if it is a valid bond
        if (_hashOfReferenceBond != 0x0) {
            // Ensure the sender of the transaction is the owner of the bond that is providing the security
            require(dataStorage[_hashOfReferenceBond].owner == msg.sender, "Invalid authorisation");

            // Ensure the bond providing the security is in an issued state
            require(dataStorage[_hashOfReferenceBond].state == Lib.BondState.Issued, "Reference bond status invalid");

            // Ensure the bond providing the security does not expire within the next few days
            require(dataStorage[_hashOfReferenceBond].maturityDate > now + DURATION_BOND_LOCK_NEXT_STATE_SEC, "Reference bond maturing too soon");
            
            // Ensure that the principal of the bond providing the underwriting is sufficient to provide underwriting for the specified bond
            require(((_principal_Cu * BOND_REQUIRED_SECURITY_REFERENCE_PPT) / 10**3) <= dataStorage[_hashOfReferenceBond].principal_Cu, "Reference bond's principal insufficient");
        }

        // *************************************
        // *** Create the Bond
        // *************************************

		// Create a new Bond hash by using random input parameters (Timestamp, nextIdx of the BondHashMapping, address of bond contract and owner address)
        bytes32 bondHash = keccak256(abi.encodePacked(hashMap.nextIdx, address(this), msg.sender));

        // Add the bond data to the data storage
        dataStorage[bondHash] = BondData({
            // Specify the hashMap.nextIdx as the index for this new bond
            idx: hashMap.nextIdx,
            // Save the address of the bond's owner
            owner: msg.sender,
            // Set the bond principal amount
            principal_Cu: _principal_Cu,
            // Set the creation date to now
            creationDate: now,
            // Set the timestamp for expiry of bond being in an underwritten state
            nextStateExpiryDate: now + DURATION_BOND_LOCK_NEXT_STATE_SEC,
            // Set the bonds status to created
            state: Lib.BondState.Created,
            // Set the remaining bond variables to 0 or 0x0
            maturityDate: 0,
            paymentAccountHash: bytes32(0x0),
            yield_Ppb: 0,
            maturityPayoutAmount_Cu: 0,
            securityReferenceHash: bytes32(0x0)
        });

        // Add the bond to the Hash map
        hashMap.add(bondHash);

        // Set and schedule the preliminary bond maturity event notification
        setScheduleMaturityEvent(bondHash);

        // Add log entry to document creation of bond
        emit LogBond(bondHash, msg.sender, bytes32(_principal_Cu), now, uint(dataStorage[bondHash].state));


        // *************************************
        // *** Secure and Sign the Bond (if applicable)
        // *************************************
        
        // In case a hash to provide a security for the newly created bond is provided continue with securing and signing the new bond
        if (_hashOfReferenceBond != 0x0) {

            // Change the bonds' status
            dataStorage[_hashOfReferenceBond].state = Lib.BondState.LockedReferenceBond;
            dataStorage[bondHash].state = Lib.BondState.SecuredReferenceBond;

            // Set the cross-references of the bonds
            dataStorage[_hashOfReferenceBond].securityReferenceHash = bondHash;
            dataStorage[bondHash].securityReferenceHash = _hashOfReferenceBond;

            // Create log entries
            emit LogBond(_hashOfReferenceBond, dataStorage[_hashOfReferenceBond].owner, bondHash, now, uint(dataStorage[_hashOfReferenceBond].state));
            emit LogBond(bondHash, dataStorage[bondHash].owner, _hashOfReferenceBond, now, uint(dataStorage[bondHash].state));

            // Submitt the bond for signing by the pool and get bond yield
            dataStorage[bondHash].yield_Ppb = Pool(getPoolAdr()).signBond(_principal_Cu, 0);

            // Change the bond's status to Signed
            dataStorage[bondHash].state = Lib.BondState.Signed;

            // Create log entries
            emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32(dataStorage[bondHash].yield_Ppb), now, uint(dataStorage[bondHash].state));
        }
    }

    /**@dev Function is called by the Insurance Pool, when a liquidity provider made a deposit and it
            has been credited to the insurance pool's Funding Account.
     * @param _paymentAccountHash The payment account hash of the sender used for this bank payment.
     * @param _paymentSubject Payment particular/code/reference to be specified for the bank transaction (must be equal to the bond hash)
     * @param _creditAmount_Cu The principal amount that has been credited to the Funding Account.
     * @return info describing an unsuccessfull funding otherwise empty (0x0)
     */
    function processAccountCredit(bytes32 _paymentAccountHash, bytes32 _paymentSubject, uint _creditAmount_Cu, uint _currentPoolDay)
        public
        isIntAuth
        returns (bool success, bytes32 info, bytes32 bondHash, bool reduceWcTransit)
    {
        // Verify if the paymentSubject provided matches the any of the Bond hashes
        if (dataStorage[_paymentSubject].owner != address(0x0))
            bondHash = _paymentSubject;
        else
            return (false, bytes32("PaymentSubject"), 0x0, false);
        

        // Verify if the bond is in a valid state (Created or Signed)
        if ((dataStorage[bondHash].state != Lib.BondState.Created) &&
            (dataStorage[bondHash].state != Lib.BondState.Signed))
        {
            // Add log entry as bond is in invalid state
            emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32("BondState"), now, uint(dataStorage[bondHash].state));
            // Return the bond is in an invalid State 'BondState'
            return (false, bytes32("BondState"), bondHash, false);
        }

        // Verify the credit has been made within the next state expiry time frame
        if (dataStorage[bondHash].nextStateExpiryDate < now) {
            // Add log entry as credit has been made too late
            emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32("ExpiryDate"), now, uint(dataStorage[bondHash].state));
            // Return the bond is in an invalid State 'BondState'
            return (false, bytes32("ExpiryDate"), bondHash, false);
        }

        // Verify the credited amount is the correct amount
        if (dataStorage[bondHash].principal_Cu != _creditAmount_Cu) {
            // Add log entry
            emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32("CreditAmount"), now, uint(dataStorage[bondHash].state));
            // return subject
            return (false, bytes32("CreditAmount"), bondHash, false);
        }

        // If bond is in a "Created" state
        if (dataStorage[bondHash].state == Lib.BondState.Created) {
            // Wc transit does not need to be reduced
            reduceWcTransit = false;
            // Change bond status
            dataStorage[bondHash].state = Lib.BondState.SecuredBondPrincipal;
            // Create log entry
            emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32(_creditAmount_Cu), now, uint(dataStorage[bondHash].state));
            
            // Submitt the bond for signing by the pool and get bond yield
            dataStorage[bondHash].yield_Ppb = Pool(getPoolAdr()).signBond(_creditAmount_Cu, _creditAmount_Cu);
            // Change the bond's status to Signed
            dataStorage[bondHash].state = Lib.BondState.Signed;
            // Create log entry
            emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32(dataStorage[bondHash].yield_Ppb), now, uint(dataStorage[bondHash].state));
        
        } else {
            // Bond is in "Signed" state (Bond was secured with a reference Bond) => Pool is expecting a payment (i.e. WcTransit has to be reduced)
            reduceWcTransit = true;
            // Get the reference bond Hash that performed the security
            bytes32 refBondHash = dataStorage[bondHash].securityReferenceHash;
            // Remove the security liablity
            dataStorage[refBondHash].securityReferenceHash = 0x0;
            // Change the state of the security bond back to issued
            dataStorage[refBondHash].state = Lib.BondState.Issued;
            // Add log entry for underwriting bond
            emit LogBond(refBondHash, dataStorage[refBondHash].owner, bytes32(dataStorage[refBondHash].maturityDate), now, uint(dataStorage[refBondHash].state));

            // Remove the underwriting bond's reference
            dataStorage[bondHash].securityReferenceHash = 0x0;
        }

        // Remove the bond's next phase expiry date
        dataStorage[bondHash].nextStateExpiryDate = 0;
        // Save the payment hash
        dataStorage[bondHash].paymentAccountHash = _paymentAccountHash;
        // Change the Bond's state to issued
        dataStorage[bondHash].state = Lib.BondState.Issued;
        
        // Calculate the preliminary BondMaturityPayoutAmount
        dataStorage[bondHash].maturityPayoutAmount_Cu = dataStorage[bondHash].principal_Cu +
            (dataStorage[bondHash].principal_Cu * dataStorage[bondHash].yield_Ppb / 10**9);

        // Calculate the day this bond matures
        uint maturityDay = _currentPoolDay + (DURATION_TO_BOND_MATURITY_SEC / 1 days);

        // Add the bond's maturity payout amount for the maturity day
        bondMaturityPayoutAmount[maturityDay] += dataStorage[bondHash].maturityPayoutAmount_Cu;

        // Set and schedule the final bond maturity event notification
        setScheduleMaturityEvent(bondHash);

        // Add log entry
        emit LogBond(bondHash, dataStorage[bondHash].owner, bytes32(dataStorage[bondHash].maturityDate), now, uint(dataStorage[bondHash].state));
        // Return empty subject as successfull
        return (true, 0x0, bondHash, reduceWcTransit);
    }

    /**@dev Performs the final bond processing (calculation of payout and penalty amounts)
            This function can only be called from internal ping function
     * @param _bondHash The hash of the bond that should be processed for maturity
     * @param _scheduledDateTime The dateTime this event is scheduled for
     * @return 0 if successfull or EPOCH timestamp for re-scheduling the bond maturity processing
     */
    function processMaturedBond(bytes32 _bondHash, uint _scheduledDateTime)
        private
        returns (uint)
    {
        // If the maturity date does not match the scheduled ping notification return 0 or
        // the bond is in a Matured or Defaulted state return 0
        if ((_scheduledDateTime < dataStorage[_bondHash].maturityDate) ||
            (dataStorage[_bondHash].state == Lib.BondState.Matured) ||
            (dataStorage[_bondHash].state == Lib.BondState.Defaulted))
            return 0;

        // Set the payout amount to the previously calculated maturity payout amount for the bond
        uint payoutAmount_Cu = dataStorage[_bondHash].maturityPayoutAmount_Cu;
        // Set the transitAmount_Cu if the Bond is 'Signed' state
        uint reduceWcTransitAmount_Cu = (dataStorage[_bondHash].state == Lib.BondState.Signed ?
            dataStorage[_bondHash].principal_Cu : 0);
        // Variable to store the penalty amount if bond is in a LockedReferenceBond state
        uint penaltyAmount_Cu = 0;

        // Calculate the penalty amount in case the Bond is 'LockedReferenceBond'
        if (dataStorage[_bondHash].state == Lib.BondState.LockedReferenceBond) {
            // Get the reference bond Hash that performed the underwriting
            bytes32 refBondHash = dataStorage[_bondHash].securityReferenceHash;
            // Calculate the penalty amount
            penaltyAmount_Cu = (dataStorage[refBondHash].principal_Cu * BOND_REQUIRED_SECURITY_REFERENCE_PPT) / 10**3;
        }

        // Calculate the final maturityPayoutAmount_Cu
        dataStorage[_bondHash].maturityPayoutAmount_Cu = payoutAmount_Cu - penaltyAmount_Cu;

        // If the maturity payout amount is greater than 0 then create a bank payment advice
        if (dataStorage[_bondHash].maturityPayoutAmount_Cu > 0) {
            // Create payment instruction for the bank
            Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.BondMaturity,
                dataStorage[_bondHash].paymentAccountHash, _bondHash, dataStorage[_bondHash].maturityPayoutAmount_Cu, _bondHash);
        }

        // Call the pool and update the bank and transit balances if applicable
        Pool(getPoolAdr()).processMaturedBond(dataStorage[_bondHash].maturityPayoutAmount_Cu, reduceWcTransitAmount_Cu);
        
        // Change the bond's status
        if (dataStorage[_bondHash].state == Lib.BondState.Issued)
            dataStorage[_bondHash].state = Lib.BondState.Matured;
        else
            dataStorage[_bondHash].state = Lib.BondState.Defaulted;
        
        // Add log entry
        emit LogBond(_bondHash, dataStorage[_bondHash].owner, bytes32(dataStorage[_bondHash].maturityPayoutAmount_Cu), now, uint(dataStorage[_bondHash].state));
        
        // Archive the bond
        hashMap.archive(_bondHash);

        // Return 0 as processing completed succefully and no event notification re-scheduling is required
        return 0;
    }

    // *******************************
    // *** Miscellaneous functions
    // *******************************

    /**@dev Calculates and returns the bond payout amounts for all the bonds when they mature.
     * @param _tommorowPoolDay The starting day (tomorrowPoolDay) to start adding the bond maturity amounts
     * @param _wcBondBalance_Cu The balance of the Bond Account
     * @return bondMaturityAverage_Cu Average bond maturity amounts per day
     * @return bondMaturityMaxSlope_Cu Maximum Slope per day
     */
    function calculateAvgBondMaxBondSlope(
        uint _tommorowPoolDay, 
        uint _wcBondBalance_Cu
        )
        public
        view
        returns (uint bondMaturityAverage_Cu, uint bondMaturityMaxSlope_Cu)
    {
        // Calculate the pool day the on which bonds are maturing at the very latest
        uint lastMaturingBondPoolDay = _tommorowPoolDay + (DURATION_TO_BOND_MATURITY_SEC / 1 days);
        // Iterate through the hash mapping of all bonds to calculate the total amount
        for (uint i = _tommorowPoolDay; i<=lastMaturingBondPoolDay; i++) {
            bondMaturityAverage_Cu += bondMaturityPayoutAmount[i];
        }
        // Calculate the average daily bond maturity amount
        bondMaturityAverage_Cu /= (lastMaturingBondPoolDay - _tommorowPoolDay);

        // Variable is required to calculate the running cumulated bond maturity balance
        uint cumulatedDailyBalance_Cu = 0;
        // Current slope - this value can also be negative!!!
        int slope_Cu = 0;
        // Calculation of the max slope
        for (uint i = _tommorowPoolDay; i<=lastMaturingBondPoolDay; i++) {
            // Add the bond maturity balance of the current day
            cumulatedDailyBalance_Cu += bondMaturityPayoutAmount[i];
            // Calculate the slope for this day
            slope_Cu = (int(cumulatedDailyBalance_Cu) - int(_wcBondBalance_Cu) + int(MIN_BOND_ACCOUNT_BALANCE_DAYS) * int(bondMaturityAverage_Cu)) / (int(i) - int(_tommorowPoolDay) + 1);
            // If this slope is greater than any previously calculated slope set it as the new max slope
            if (slope_Cu > int(bondMaturityMaxSlope_Cu)) {
                // Set the new max slope
                bondMaturityMaxSlope_Cu = uint(slope_Cu);
            }
        }
    }


    /**@dev Calculates and returns the bond payout amounts for all the bonds when they mature.
     * @param _beginDay The starting day (currentPoolDay) to start adding the bond maturity amounts
     * @param _endDay The last day to add the the bond maturity aount for
     * @return bondMaturityPayoutAmountNext3Days_Cu Total amount of expected bond payouts for today, tomorrow and the day after tomorrow.
     * @return bondMaturityPayoutFuturePerDay_Cu Total amount of expected bond payouts in the future on a per day basis
     */
    function getBondMaturityPayouts(uint _beginDay, uint _endDay)
        public
        view
        returns (uint bondMaturityPayoutAmountNext3Days_Cu, uint bondMaturityPayoutFuturePerDay_Cu)
    {
        // Iterate through the hash mapping of all bonds between the first and the last idx
        for (uint i = _beginDay; i<=_endDay; i++) {
            bondMaturityPayoutFuturePerDay_Cu += bondMaturityPayoutAmount[i];
        }

        // Calculate the combined bond maturity payout amounts for today, tomorrow and the day after tomorrow
        bondMaturityPayoutAmountNext3Days_Cu = bondMaturityPayoutAmount[_beginDay] + bondMaturityPayoutAmount[_beginDay + 1] + bondMaturityPayoutAmount[_beginDay + 2];
        
        // Calculate the bond maturity payouts for the future on a per day basis
        bondMaturityPayoutFuturePerDay_Cu /= (_endDay - _beginDay);

        // Return the
        return (bondMaturityPayoutAmountNext3Days_Cu, bondMaturityPayoutFuturePerDay_Cu);
    }

    /**@dev Calculates the maturity time for the bond and schedules a ping notification
     * @param _bondHash The hash of the bond to schedule the maturity ping notification for
     */
    function setScheduleMaturityEvent(bytes32 _bondHash)
        private
    {
        // Calculate the maturity time for the bond
        dataStorage[_bondHash].maturityDate = now + Pool(getPoolAdr()).DURATION_TO_BOND_MATURITY_SEC();
        // Adjust the maturity date slightly to by reducing the last digit to 0
        // This is required for successfull Ping notification execution in the function processMaturedBond()
        // e.g. A ping notification originally scheduled for timestamp 1508355318 is now scheduled for 1508355310 (last digit is replaced by 0)
        dataStorage[_bondHash].maturityDate -= dataStorage[_bondHash].maturityDate % 10;
        // Schedule the event notification with the Timer contract
        Timer(getTimerAdr()).addNotification(dataStorage[_bondHash].maturityDate,
            uint8(NotificationSubject.BondMaturity), _bondHash, address(this));
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
        if (_subject == uint8(NotificationSubject.BondMaturity)) {
            return processMaturedBond(_message, _scheduledDateTime);
        }
        return 0;
    }

    // *******************************
    // Bond enums and structs
    // *******************************

    // Enum of the diffent Notification subjects of the pool
    enum NotificationSubject {
        /*0*/ BondMaturity
    }
}