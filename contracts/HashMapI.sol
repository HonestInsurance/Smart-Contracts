/**
 * @description Hash Map Interface contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.5.7;

import "./Lib.sol";

/** @title Hash Map contract that can be inherited by any contracts that requires an iterable mapping */
contract HashMapI {

    // Mapping to allow iterating through the hashes
    using Lib for Lib.HashMappping;
    Lib.HashMappping public hashMap = Lib.HashMappping({firstIdx: 1, nextIdx:1, count: 0 });

    /**
     * @dev Verifies if the hash provided is a currently an active hash
     * @param _hash Hash to verify
     * @return Indicates if the hash is active (and part of the mapping)
     */
    function isActive(bytes32 _hash) public view returns (bool) {
        return hashMap.isActive(_hash);
    }

    /**
     * @dev Verifies if the hash provided is an archived hash and part of the mapping
     * @param _hash Hash to verify
     * @return Indicates if the hash is archived (and part of the mapping)
     */
    function isArchived(bytes32 _hash) public view returns (bool) {
        return hashMap.isArchived(_hash);
    }

    /**
    * @dev Verifies if the hash provided is either an active or archived hash and part of the mapping
    * @param _hash Hash to verify
    * @return Indicates if the hash is either active or archived (part of the mapping)
    */
    function isValid(bytes32 _hash) public view returns (bool) {
        return hashMap.isValid(_hash);
    }

    /**
     * @dev Retrieve the hash stored and the position of _idx
     * @param _idx Index of the hash to retrieve
     * @return Hash specified by the _idx value (returns 0x0 if _idx is an invalid index)
     */
    function get(uint _idx) public view returns (bytes32) {
        return hashMap.get(_idx);
    }
}