/**
 * @description Trust contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.5.0;

import "./Pool.sol";
import "./IntAccessI.sol";
import "./ExtAccessI.sol";
import "./Adjustor.sol";


/** @title Trust contract for the Insurance Pool.*/
contract Trust is IntAccessI, ExtAccessI {

    // Events broadcasted by the Trust / Log events
    event LogTrust(bytes32 indexed subject, address indexed adr, bytes32 indexed info, uint timestamp);

    /**@dev Constructor of the Trust.
     */
    constructor() IntAccessI(msg.sender) ExtAccessI(msg.sender) public {
        // Add log entry
        emit LogTrust(bytes32("TrustContractCreation"), address(this), 0x0, now);
    }

    /**@dev Function initialises the addresses of insurance pool ecosystem (can be called only once).
     * @param _poolAdr The address of the pool.
     * @param _bondAdr The address of the bond.
     * @param _bankAdr The address of the bank.
     * @param _policyAdr The address of the policy.
     * @param _settlementAdr The address of the settlement.
     * @param _adjustorAdr The address of the adjustor.
     * @param _timerAdr The address of the timer.
     * @param _isWinterTime Indicates if it is summer or winter time
     */
    function initEcosystem(
        address _poolAdr,
        address _bondAdr,
        address _bankAdr,
        address _policyAdr,
        address _settlementAdr,
        address _adjustorAdr,
        address _timerAdr,
        bool _isWinterTime
        )
        public
        isExtAuth
    {
        // Verify no addresses have been specified previously
        require(
            getPoolAdr() == address(0x0) &&
            getBondAdr() == address(0x0) &&
            getBankAdr() == address(0x0) &&
            getPolicyAdr() == address(0x0) &&
            getSettlementAdr() == address(0x0) &&
            getAdjustorAdr() == address(0x0) &&
            getTimerAdr() == address(0x0),
            "Contract addresses are already set");

        // Initialise the contract addresses for this Pool contract
        setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);

        // Call the other contracts and initialise them as well
        IntAccessI(_poolAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        IntAccessI(_bondAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        IntAccessI(_bankAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        IntAccessI(_policyAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        IntAccessI(_settlementAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        IntAccessI(_adjustorAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        IntAccessI(_timerAdr).setContractAdr(address(this), _poolAdr, _bondAdr, _bankAdr, _policyAdr, _settlementAdr, _adjustorAdr, _timerAdr);
        
        // Add log entries
        emit LogTrust(bytes32("SetTrustAddress"), address(this), 0x0, now);
        emit LogTrust(bytes32("SetPoolAddress"), _poolAdr, 0x0, now);
        emit LogTrust(bytes32("SetBondAddress"), _bondAdr, 0x0, now);
        emit LogTrust(bytes32("SetBankAddress"), _bankAdr, 0x0, now);
        emit LogTrust(bytes32("SetPolicyAddress"), _policyAdr, 0x0, now);
        emit LogTrust(bytes32("SetSettlementAddress"), _settlementAdr, 0x0, now);
        emit LogTrust(bytes32("SetAdjustorAddress"), _adjustorAdr, 0x0, now);
        emit LogTrust(bytes32("SetTimerAddress"), _timerAdr, 0x0, now);

        // Initialise the pool variables
        Pool(_poolAdr).initEcosystem(_isWinterTime);
    }

    /**@dev Function overwrites the WC_Exp_Cu to use for next overnight processing.
            Preauthorisation is required to perform this operation.
     * @param _wcExpenses_Cu Total Expenses of the pool within the DURATION_WC_EXPENSE_HISTORY_SEC period
     */
    function setWcExpenses(uint _wcExpenses_Cu)
        public
        isExtAuth
    {
        Pool(getPoolAdr()).setWcExpenses(_wcExpenses_Cu);
    }

    /**@dev Function needs to be called by the  pool owners to inform the pool about daylight saving and leap second adjustments
            within the 24 hours before the event occurs. Preauthorisation is required to perform this operation.
     */
    function adjustDaylightSaving()
        public
        isExtAuth
    {
        Pool(getPoolAdr()).adjustDaylightSaving();
        emit LogTrust(bytes32("ChangeInDaylightSaving"), msg.sender, 0x0, now);
    }

    /**@dev Creates an new adjustor with the requested details - can only be called by the Trust
     * @param _adjustorAdr Address/public key of the adjustor authorising the adjustor to submitt and process settlements
     * @param _settlementApprovalAmount_Cu The amount this adjustor is authorised to process settlements
     * @param _policyRiskPointLimit The risk point limit this adjustor is authorised to underwrite policies
     * @param _serviceAgreementHash The hash of the new service agreement with the adjustor
     */
    function createAdjustor(address _adjustorAdr, uint _settlementApprovalAmount_Cu, uint _policyRiskPointLimit, bytes32 _serviceAgreementHash)
        public
        isExtAuth
    {
        Adjustor(getAdjustorAdr()).createAdjustor(_adjustorAdr, _settlementApprovalAmount_Cu, _policyRiskPointLimit, _serviceAgreementHash);
    }

    /**@dev Creates an new adjustor with the requested details - can only be called by the Trust
     * @param _adjustorHash Hash of the adjustor that needs to be updated
     * @param _adjustorAdr Address/public key of the adjustor authorising the adjustor to submitt and process settlements
     * @param _settlementApprovalAmount_Cu The amount this adjustor is authorised to process settlements
     * @param _policyRiskPointLimit The risk point limit this adjustor is authorised to underwrite policies
     * @param _serviceAgreementHash The hash of the new service agreement with the adjustor
     */
    function updateAdjustor(bytes32 _adjustorHash, address _adjustorAdr, uint _settlementApprovalAmount_Cu, uint _policyRiskPointLimit, bytes32 _serviceAgreementHash)
        public
        isExtAuth
    {
        Adjustor(getAdjustorAdr()).updateAdjustor(_adjustorHash, _adjustorAdr, _settlementApprovalAmount_Cu, _policyRiskPointLimit, _serviceAgreementHash);
    }

    /**@dev Creates an new adjustor with the requested details - can only be called by the Trust
     * @param _adjustorHash Hash of the adjustor that needs to be retired
     */
    function retireAdjustor(bytes32 _adjustorHash)
        public
        isExtAuth
    {
        Adjustor(getAdjustorAdr()).retireAdjustor(_adjustorHash);
    }

    // function changePoolEmergencyState()
    //     public
    //     isPreAuth
    // {
    // }

    // function adjustBondYield(uint yield_Ppb)
    //     public
    //     isPreAuth
    // {   
    // }

    // function initiatePoolRetirement()
    //     public
    //     isPreAuth
    // {
    // }
}