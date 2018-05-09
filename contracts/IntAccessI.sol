/**
 * @description Internal Access Interface contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.23;


/** @title Is used by contracts that receive function calls to be authorised from other contract transactions.*/
contract IntAccessI {

    // Address variables of the contract addresses in this solution
    address private trustAdr;
    address private poolAdr;
    address private bondAdr;
    address private bankAdr;
    address private policyAdr;
    address private settlementAdr;
    address private adjustorAdr;
    address private timerAdr;

    /**
    * @dev Constructor for IntAccessI.
    * @param _trustAdr Address of the trust contract
    */
    constructor(address _trustAdr) public {
        // Verify a valid deployment controller address
        require(_trustAdr != address(0x0));
        // Save the deployment controller's address
        trustAdr = _trustAdr;
    }

    /**
    * @dev Modifier verifies if sender is an authorised controller contract being part of this solution
    */
    modifier isIntAuth() {
        // Verify the sender is either the Trust, Pool, Bond, Bank Policy, Settlement, Adjustor or Timer contract
        require((msg.sender == trustAdr) || (msg.sender == poolAdr) || (msg.sender == bondAdr) || (msg.sender == bankAdr) || (msg.sender == policyAdr) || (msg.sender == settlementAdr) || (msg.sender == adjustorAdr) || (msg.sender == timerAdr));
        _;
    }

    /**
    * @dev Modifiers verifies if sender is an authorised controller contract
    */
    modifier isTrustAuth() {require((msg.sender == trustAdr)); _;}
    modifier isPoolAuth() {require((msg.sender == poolAdr)); _;}
    modifier isBondAuth() {require((msg.sender == bondAdr)); _;}
    modifier isBankAuth() {require((msg.sender == bankAdr)); _;}
    modifier isPolicyAuth() {require((msg.sender == policyAdr)); _;}
    modifier isSettlementAuth() {require((msg.sender == settlementAdr)); _;}
    modifier isAdjustorAuth() {require((msg.sender == adjustorAdr)); _;}
    modifier isTimerAuth() {require((msg.sender == timerAdr)); _;}

    /**
     * @dev This modifiers checks if the provided address is a contract address or an externaly owned account
     * @param _adr Address to verify
     */
    modifier isNotContractAdr(address _adr) {
        uint size;
        // Retrieve the size of the code that is stored against the provided address
        assembly { size := extcodesize(_adr) }
        // Ensure that the 'address size' is 0 (if the size is greater than 0 this address is owned by a contract)
        require(size == 0);
        _;
    }

    /**
    * @dev Sets all the contract addresses for the solution
    */
    function setContractAdr(
        address _trustAdr,
        address _poolAdr, 
        address _bondAdr, 
        address _bankAdr, 
        address _policyAdr, 
        address _settlementAdr, 
        address _adjustorAdr, 
        address _timerAdr
    )
        public
        isTrustAuth
    {
        // Verify valid address have been provided for all contracts
        require(_trustAdr != address(0x0));
        require(_poolAdr != address(0x0));
        require(_bondAdr != address(0x0));
        require(_bankAdr != address(0x0));
        require(_policyAdr != address(0x0));
        require(_settlementAdr != address(0x0));
        require(_adjustorAdr != address(0x0));
        require(_timerAdr != address(0x0)); 

        // Save the remaining contract's addresses
        trustAdr = _trustAdr;
        poolAdr = _poolAdr;
        bondAdr = _bondAdr;
        bankAdr = _bankAdr;
        policyAdr = _policyAdr;
        settlementAdr = _settlementAdr;
        adjustorAdr = _adjustorAdr;
        timerAdr = _timerAdr;
    }

    /**
    * @dev Returns all the internal contract addresses
    * @return The 8 address of the contracts
    */
    function getContractAdr() public view returns (
        address trustContractAdr,
        address poolContractAdr, 
        address bondContractAdr, 
        address bankContractAdr, 
        address policyContractAdr, 
        address settlementContractAdr, 
        address adjustorContractAdr, 
        address timerContractAdr) 
    {
        return (trustAdr, poolAdr, bondAdr, bankAdr, 
            policyAdr, settlementAdr, adjustorAdr, timerAdr);
    }

    function getTrustAdr() public view returns (address) { return trustAdr; }
    function getPoolAdr() public view returns (address) { return poolAdr; }
    function getBondAdr() public view returns (address) { return bondAdr; }
    function getBankAdr() public view returns (address) { return bankAdr; }
    function getPolicyAdr() public view returns (address) { return policyAdr; }
    function getSettlementAdr() public view returns (address) { return settlementAdr; }
    function getAdjustorAdr() public view returns (address) { return adjustorAdr; }
    function getTimerAdr() public view returns (address) { return timerAdr; }
}