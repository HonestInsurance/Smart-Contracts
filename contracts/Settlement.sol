/**
 * @description Settlement contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.23;

import "./Lib.sol";
import "./SetupI.sol";
import "./IntAccessI.sol";
import "./HashMapI.sol";
import "./Adjustor.sol";
import "./Policy.sol";
import "./Bank.sol";
import "./Pool.sol";


/** @title Settlement contract*/
contract Settlement is SetupI, IntAccessI, HashMapI {

    struct SettlementData {
        // Index of this Settlement
        uint idx;
        // The final OR anticipated settlement amount (if the settlement is not in an closed state this is the expected settlement amount)
        uint settlementAmount;
        // Different states a Settlement can be in 
        Lib.SettlementState state;
    }

    // Storage mapping for all the settlements
    mapping(bytes32 => SettlementData) public dataStorage;

    // Events broadcasted by the Settlement / Log events
    event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);

    /**@dev Constructor of the Settlement.
     * @param _trustAdr The address of the Trust.
     */
    constructor(address _trustAdr) IntAccessI(_trustAdr) public {
    }

    /**
    * @dev Modifier verifies if the Adjustor hash and signing private key of the transaction are valid
    */
    modifier isAdjustorSettlementPermissioned(bytes32 _adjustorHash, uint _settlementAmount) {
        require(Adjustor(getAdjustorAdr()).isAdjustorSettlementPermissioned(_adjustorHash, msg.sender, _settlementAmount) == true);
        _;
    }

    /**@dev Creates a new settlement entry
     * @param _adjustorHash Hash of the adjustor submitting this transaction
     * @param _policyHash Hash of the policy this settlement refers to - is optional parameter
     * @param _documentHash Hash of a document that is relevant to this settlement
     */
    function createSettlement(bytes32 _adjustorHash, bytes32 _policyHash, bytes32 _documentHash)
        public
        isAdjustorSettlementPermissioned(_adjustorHash, 0)
    {
        // In case a policy hash has been provided, verify if it is a valid policy hash
        if (_policyHash != 0x0) {
            require(Policy(getPolicyAdr()).isValid(_policyHash) == true);
        }
        
        // *** Create the Settlement

		// Create a new Settlement hash by using random input parameters (Timestamp, nextIdx of the SettlementHashMapping)
        bytes32 settlementHash = keccak256(hashMap.nextIdx, msg.sender, now);

        // Add the settlement data to the data storage
        dataStorage[settlementHash] = SettlementData({
            // Specify the hashMap.nextIdx as the index for this new settlement
            idx: hashMap.nextIdx,
            // The settlement amount
            settlementAmount: 0,
            // Set the settlement status to created
            state: Lib.SettlementState.Created
        });

        // Add the settlement to the Hash map
        hashMap.add(settlementHash);

        // Create log entry to document creation of the Settlement
        emit LogSettlement(settlementHash, _adjustorHash, _policyHash, now, uint(dataStorage[settlementHash].state));

        // If a valid document hash has been provided create another log entry and change the state to processing
        if (_documentHash != 0x0) {
            // Change state to processing
            dataStorage[settlementHash].state = Lib.SettlementState.Processing;
            // Add log entry
            emit LogSettlement(settlementHash, _adjustorHash, _documentHash, now, uint(dataStorage[settlementHash].state));
        }
    }

    /**@dev Adds the specified document hash as additional information for this settlement
     * @param _settlementHash Hash of the settlement
     * @param _adjustorHash Hash of the adjustor submitting this transaction
     * @param _documentHash Hash of a document that is relevant to this settlement and needs to be added
     */
    function addSettlementInfo(bytes32 _settlementHash, bytes32 _adjustorHash, bytes32 _documentHash) 
        public
        isAdjustorSettlementPermissioned(_adjustorHash, 0)
    {
        // Ensure an active and valid settlement hash has been provided
        require(hashMap.isActive(_settlementHash) == true);
        // Ensure a valid document hash has been provided
        require(_documentHash != 0x0);
        
        // Change state to processing
        dataStorage[_settlementHash].state = Lib.SettlementState.Processing;
        // Add log entry
        emit LogSettlement(_settlementHash, _adjustorHash, _documentHash, now, uint(dataStorage[_settlementHash].state));
    }

    /**@dev Closes a settlement
     * @param _settlementHash Hash of the settlement
     * @param _adjustorHash Hash of the adjustor submitting this transaction
     * @param _documentHash Hash of a document that is relevant to this settlement - is optional
     * @param _settlementAmount The final amount this settlment is settled for
     */
    function closeSettlement(bytes32 _settlementHash, bytes32 _adjustorHash, bytes32 _documentHash, uint _settlementAmount) 
        public
        isAdjustorSettlementPermissioned(_adjustorHash, _settlementAmount)
    {
        // Ensure an active and valid settlement hash has been provided
        require(hashMap.isActive(_settlementHash) == true);
        // Ensure a valid document hash has been provided
        require(_documentHash != 0x0);
    
        // If a previous settlement amount has been set and WC Locked established remove it now
        if (dataStorage[_settlementHash].settlementAmount > 0)
            setExpectedSettlementAmount(_settlementHash, _adjustorHash, 0);

        // Save the final settlement amount
        dataStorage[_settlementHash].settlementAmount = _settlementAmount;

        // Create Bank payment advice if settlement amount is greater than 0
        if (dataStorage[_settlementHash].settlementAmount > 0) {
            // Create payment instruction for the bank
            Bank(getBankAdr()).createPaymentAdvice(Lib.PaymentAdviceType.ServiceProvider,
                SETTLEMENT_ACCOUNT_PAYMENT_HASH, _settlementHash, dataStorage[_settlementHash].settlementAmount, _settlementHash);
        }

        // Change settlement state to Settled
        dataStorage[_settlementHash].state = Lib.SettlementState.Settled;
    
        // Add log entry
        emit LogSettlement(_settlementHash, _adjustorHash, _documentHash, now, uint(dataStorage[_settlementHash].state));

        // Archive the settlement
        hashMap.archive(_settlementHash);
    }

    /**@dev Set the expected amount that needs to be settled in the future for this settlement
     * @param _settlementHash Hash of the settlement
     * @param _adjustorHash Hash of the adjustor submitting this transaction
     * @param _expectedSettlementAmount The expected amount this settlment will be settled for
     */
    function setExpectedSettlementAmount(bytes32 _settlementHash, bytes32 _adjustorHash, uint _expectedSettlementAmount) 
        public
        isAdjustorSettlementPermissioned(_adjustorHash, _expectedSettlementAmount)
    {
        // Ensure an active and valid settlement hash has been provided
        require(hashMap.isActive(_settlementHash) == true);
        // Call the pool and adjust WC Locked accordingly (increase or decrease)
        if (dataStorage[_settlementHash].settlementAmount < _expectedSettlementAmount) {
            // Increase WC locked
            Pool(getPoolAdr()).adjustWcLocked(_expectedSettlementAmount - dataStorage[_settlementHash].settlementAmount, true);
        } else {
            // Decrease WC locked
            Pool(getPoolAdr()).adjustWcLocked(dataStorage[_settlementHash].settlementAmount - _expectedSettlementAmount, false);
        }
        // Save the new expected settlement amount
        dataStorage[_settlementHash].settlementAmount = _expectedSettlementAmount;
    }
}