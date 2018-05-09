/**
 * @description External Access Interface contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.23;


/** @title Interface contract managing external access keys for authorisation and authentication.*/
contract ExtAccessI {

    // Time duration pre-authorisation remains active in seconds
    uint public constant EXT_ACCESS_PRE_AUTH_DURATION_SEC = 5 minutes;
    
    // Storage mapping for 5 access keys (0, 1, 2, 3, 4)
    mapping(uint => address) private authKeys;

    // Address variable that was used to perform pre-authorisation
    address private preAuthKeyUsed = 0x0;

    // Pre-authorisation expiry timestamp
    uint private preAuthExpiry = 0;

    /**
    * @dev Constructor for ExtAccessI.
    * @param _adr Address to add as the first key.
    */
    constructor(address _adr) public {
        // Verify a valid address has been provided
        require(_adr != address(0x0));
        // Add the address provided to the authorised keys
        addKey(_adr);
    }

    /**
    * @dev Modifier verifies if sender is authorised to perform a transaction
    */
    modifier isExtAuth() {
        require(
            (authKeys[0] == address(0x0)) ||    // If no key is specified authorisation is granted
            (authKeys[0] == msg.sender) ||      // If it matches key 0 authorisation is granted
            (authKeys[1] == msg.sender)         // If it matches key 1 authorisation is granted
        );
        _;
    }

    /**
    * @dev Modifier verifies if sender is authorised to complete a transaction that requires pre-authorisation
    */
    modifier isPreAuth() {
        // If 3 or more keys are specified a valid pre-authorisation needs to exist
        if (authKeys[2] != address(0x0)) {
            // Verify if pre-auth exist, is still valid and current sender of the transaction is not the pre-auth key used
            require((preAuthExpiry > now) && (preAuthKeyUsed != address(0x0)) && (preAuthKeyUsed != msg.sender)); 
            // Check the sender of the transaction matches any of the specified keys
            require(
                (authKeys[1] == msg.sender) ||
                (authKeys[2] == msg.sender) || 
                (authKeys[3] == msg.sender) || 
                (authKeys[4] == msg.sender)
            );
        
        } else {
            // If less than 3 keys are specified no pre-authorisation needs to exist
            require(
                // No key is specified
                (authKeys[0] == address(0x0)) ||
                // One key is currently specified check if it matches that key
                ((authKeys[1] == address(0x0)) && (authKeys[0] == msg.sender)) ||
                // Two keys are currently specified check if it matches the key in key slot 1
                ((authKeys[2] == address(0x0)) && (authKeys[1] == msg.sender))
            );
        }
        // Remove pre-authorisation
        preAuthKeyUsed = address(0x0);
        // Remove preAuthExpiry
        preAuthExpiry = 0;
        _;
    }

    /**
    * @dev Performs a pre-authorisation by msg.sender. If successful the ExtAccessI is in a pre-authorised state.
    */
    function preAuth() public {
        // Ensure that at least 3 keys have been specified
        require(authKeys[2] != address(0x0));

        // Ensure msg.sender matches the keys in key slot 1, 2, 3 or 4
        require(
            (authKeys[1] == msg.sender) || 
            (authKeys[2] == msg.sender) || 
            (authKeys[3] == msg.sender) ||
            (authKeys[4] == msg.sender)
        );
        
        // Save the pre-authorisation key used
        preAuthKeyUsed = msg.sender;
        // Set the pre-authorisation expiry time
        preAuthExpiry = EXT_ACCESS_PRE_AUTH_DURATION_SEC + now;
    }

    /**
    * @dev Adds a new key to the authorised keys. Only up to 5 unique keys can be specified.
    * @param _adr Key to add.
    */
    function addKey(address _adr)
        public
        isPreAuth
    {
        // Check if it is a valid key
        require(_adr != address(0x0));
       
        // Check if the new key is not yet part of the authorised keys list (no duplications)
        require(
            (authKeys[0] != _adr) && 
            (authKeys[1] != _adr) && 
            (authKeys[2] != _adr) &&
            (authKeys[3] != _adr) && 
            (authKeys[4] != _adr)
        );
        
        // Check if not all key slots have already been filled
        require(authKeys[4] == address(0x0));

        // Check if the address provided is not a contract address (must be an externally owned account)
        uint size;
        // Retrieve the size of the code that is stored against the provided address
        assembly { size := extcodesize(_adr) }
        // Ensure that the 'address size' is 0 (if the size is greater than 0 this address is owned by a contract)
        require(size == 0);

        // Add the key to the first empty key slot
        if (authKeys[0] == address(0x0)) 
            authKeys[0] = _adr;
        else if (authKeys[1] == address(0x0))
            authKeys[1] = _adr;
        else if (authKeys[2] == address(0x0))
            authKeys[2] = _adr;
        else if (authKeys[3] == address(0x0)) 
            authKeys[3] = _adr;
        else if (authKeys[4] == address(0x0)) 
            authKeys[4] = _adr;
    }

    /**
    * @dev Removes key in key slot 0 and move up all the remaining keys. All 5 key slots need to be filled.
    */
    function rotateKey()
        public
        isPreAuth
    {
        // Ensure all key slots have already been filled
        require(authKeys[4] != address(0x0));

        // Rotate the keys and remove the key in key slot 0
        authKeys[0] = authKeys[1];
        authKeys[1] = authKeys[2];
        authKeys[2] = authKeys[3];
        authKeys[3] = authKeys[4];
        authKeys[4] = address(0x0);
    }

    /**
    * @dev Returns the requested key in the specified key slot
    * @return The configured access keys.
    */
    function getExtAccessKey() public view returns (
        address authKey0, 
        address authKey1, 
        address authKey2, 
        address authKey3,
        address authKey4)
    {
        return (authKeys[0], authKeys[1], authKeys[2], authKeys[3], authKeys[4]);
    }

    /**
    * @dev Returns the pre-authorisation key if one has been specified.
    * @return The address of the used pre-authorisation key used.
    */
    function getPreAuthKey() public view returns (address) {
        return preAuthKeyUsed;
    }

    /**
    * @dev Returns the timestamp when pre-authorisation expires.
    * @return EPOCH time when pre-authorisation expires. 
    */
    function getPreAuthExpiry() public view returns (uint) {
        return preAuthExpiry;
    }
}