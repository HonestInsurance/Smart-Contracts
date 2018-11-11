/**
 * @description Library contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.24;


/** @title Library functions used by contracts within this ecosystem.*/
library Lib {
    
    /**
    * @dev Enum of the diffent Bank accounts held by the pool
    */
    enum PaymentAdviceType {
        /*0*/ PremiumRefund,
        /*1*/ Premium,
        /*2*/ BondMaturity,
        /*3*/ Overflow,
        /*4*/ PoolOperator,
        /*5*/ ServiceProvider,
        /*6*/ Trust
    }

    /**
    * @dev Enum of the diffent Bank accounts held by the pool
    */
    enum AccountType {
        /*0*/ PremiumAccount,
        /*1*/ BondAccount,
        /*2*/ FundingAccount
    }

    /**
    * @dev Enum of the two types of bank transactions (Credit; Debit)
    */
    enum TransactionType {
        /*0*/ Credit,
        /*1*/ Debit
    }

    /**
    * @dev Enum of the different states a Bond can be in.
    */
    enum BondState {
        /*0*/ Created,
        /*1*/ SecuredBondPrincipal,
        /*2*/ SecuredReferenceBond,
        /*3*/ Signed,
        /*4*/ Issued,
        /*5*/ LockedReferenceBond,
        /*6*/ Defaulted,
        /*7*/ Matured
    }

    /**
    * @dev Enum of the different states a Policy can be in.
    */
    enum PolicyState {
        /*0*/ Paused,       // Policy owner deactivated the policy termporarily (temporarily prevent from continuing or being in force or effect)
        /*1*/ Issued,       // Policy is in an active state
        /*2*/ Lapsed,       // Policy ran out of funds (no longer valid; expired.)
        /*3*/ PostLapsed,   // Policy has been refunded and is due for Re-Issuing
        /*4*/ Retired       // The policy has been cancelled and is archived permanently.
    }

    /**
    * @dev Enum of the different states a Settlement can be in.
    */
    enum SettlementState {
        /*0*/ Created,      // An adjustor created a new Settlement
        /*1*/ Processing,   // Settlement is in a processing state
        /*2*/ Settled       // The settlement request has been completed (no further amendments are possible)
    }
    
    /**
     * @dev Enum to store the states of HashMapping entries
     */
     enum HashState {
         /*0*/ Invalid,
         /*1*/ Active,
         /*2*/ Archived
     }

    /**
    * @dev Efficient storage container for active and archived hashes enabling iteration
    */
	struct HashMappping {
        mapping(bytes32 => HashState) hashState;
        mapping(uint => bytes32) itHashMap;
        uint firstIdx;
        uint nextIdx;
        uint count;
    }

    /**
    * @dev Add a new hash to the storage container if it is not yet part of it
    * @param self Struct storage container pointing to itself
    * @param _hash Hash to add to the struct
    */
    function add(HashMappping storage self, bytes32 _hash) public {
        // Ensure that the hash has not been previously already been added (is still in an invalid state)
        assert(self.hashState[_hash] == HashState.Invalid);
        // Set the state of hash to Active
        self.hashState[_hash] = HashState.Active;
        // Index the hash with the next idx
        self.itHashMap[self.nextIdx] = _hash;
        self.nextIdx++;
        self.count++;
    }

    /**
    * @dev Archives an existing hash if it is an active hash part of the struct
    * @param self Struct storage container pointing to itself
    * @param _hash Hash to archive in the struct
    */
    function archive(HashMappping storage self, bytes32 _hash) public {
        // Ensure that the state of the hash is active
        assert(self.hashState[_hash] == HashState.Active);
        // Set the State of hash to Archived
        self.hashState[_hash] = HashState.Archived;
        // Reduce the size of the number of active hashes
        self.count--;

        // Check if the first hash in the active list is in an archived state
        if (self.hashState[self.itHashMap[self.firstIdx]] == HashState.Archived) {
            self.firstIdx++;
        }

        // Repeat one more time to allowing for 'catch up' of firstIdx;
        // Check if the first hash in the active list is still active or has it already been archived
        if (self.hashState[self.itHashMap[self.firstIdx]] == HashState.Archived) {
            self.firstIdx++;
        }
    }

    /**
    * @dev Verifies if the hash provided is a currently active hash and part of the mapping
    * @param self Struct storage container pointing to itself
    * @param _hash Hash to verify
    * @return Indicates if the hash is active (and part of the mapping)
    */
    function isActive(HashMappping storage self, bytes32 _hash) public view returns (bool) {
        return self.hashState[_hash] == HashState.Active;
    }

    /**
    * @dev Verifies if the hash provided is an archived hash and part of the mapping
    * @param self Struct storage container pointing to itself
    * @param _hash Hash to verify
    * @return Indicates if the hash is archived (and part of the mapping)
    */
    function isArchived(HashMappping storage self, bytes32 _hash) public view returns (bool) {
        return self.hashState[_hash] == HashState.Archived;
    }

    /**
    * @dev Verifies if the hash provided is either an active or archived hash and part of the mapping
    * @param self Struct storage container pointing to itself
    * @param _hash Hash to verify
    * @return Indicates if the hash is either active or archived (part of the mapping)
    */
    function isValid(HashMappping storage self, bytes32 _hash) public view returns (bool) {
        return self.hashState[_hash] != HashState.Invalid;
    }

    /**
    * @dev Retrieve the specified (_idx) hash from the struct
    * @param self Struct storage container pointing to itself
    * @param _idx Index of the hash to retrieve
    * @return Hash specified by the _idx value (returns 0x0 if _idx is an invalid index)
    */
    function get(HashMappping storage self, uint _idx) public view returns (bytes32) {
        return self.itHashMap[_idx];
    }
}