/**
 * @description Setup Interface contract
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

pragma solidity ^0.4.24;

import "./Lib.sol";


/** @title Insurance Pool Contract storing all its parameters.*/ 
contract SetupI {
    // Name of the insurance Pool
    string public constant POOL_NAME = "HIC Pool # 1";

    // Constants used by the Insurance Pool
    uint public constant WC_POOL_TARGET_TIME_SEC = 90 days;                // (90 Days)
    uint public constant DURATION_TO_BOND_MATURITY_SEC = 90 days;          // (90 Days)
    uint public constant DURATION_BOND_LOCK_NEXT_STATE_SEC = 2 days;       // (2 Days)
    uint public constant DURATION_WC_EXPENSE_HISTORY_DAYS = 14;            // (14 Days)

    // Yield constants
    uint public constant YAC_PER_INTERVAL_PPB = 20000000;               // (2% per hour)
    uint public constant YAC_INTERVAL_DURATION_SEC = 1 hours;           // Accellerate yield in 1 hour intervals
    uint public constant YAC_EXPENSE_THRESHOLD_PPT = 100;               // (10 %)
    uint public constant MIN_YIELD_PPB = 5000000;                       // (0.5 %)
    uint public constant MAX_YIELD_PPB = 500000000;                     // (50 %)

    // Bond constants
    uint public constant MIN_BOND_PRINCIPAL_CU = 10000;                 // ($ 100)
    uint public constant MAX_BOND_PRINCIPAL_CU = 10000000;              // ($ 100.000,--)
    uint public constant BOND_REQUIRED_SECURITY_REFERENCE_PPT = 200;    // (20 %)

    // Policy constants
    uint public constant MIN_POLICY_CREDIT_CU = 10000;                  // ($ 100)
    uint public constant MAX_POLICY_CREDIT_CU = 5000000;                // ($ 50.000,--)
    uint public constant MAX_DURATION_POLICY_RECONCILIATION_DAYS = 100;
    uint public constant POLICY_RECONCILIATION_SAFETY_MARGIN = 3;
    uint public constant MIN_DURATION_POLICY_PAUSED_DAY = 1;
    uint public constant MAX_DURATION_POLICY_PAUSED_DAY = 2;
    uint public constant DURATION_POLICY_POST_LAPSED_DAY = 1;
    uint public constant MAX_DURATION_POLICY_LAPSED_DAY = 5;

    // Pool processing costants
    uint public constant POOL_DAILY_PROCESSING_OFFSET_SEC = 0;
    uint public constant POOL_DAYLIGHT_SAVING_ADJUSTMENT_SEC = 1 hours;
    int public constant POOL_TIME_ZONE_OFFSET = -43200;

    // Operator and Trust fees
    uint public constant POOL_OPERATOR_FEE_PPT = 50;     // (5 %)
    uint public constant TRUST_FEE_PPT = 10;             // (1 %)
        
    // Hashes of the bank account owner and bank account number (sha3(accountOwner, accountNumber))
    bytes32 public constant PREMIUM_ACCOUNT_PAYMENT_HASH =    0x9701a3e1840f59635c219124a5166d8eb2dfd539967f3c80e19f75e48f7df1fc;
    bytes32 public constant BOND_ACCOUNT_PAYMENT_HASH =       0x23e2f15b66feab75c1e6aee1f874ef01b346636c780216c8ed4d327be495ac84;
    bytes32 public constant FUNDING_ACCOUNT_PAYMENT_HASH =    0x523009c7e41b6b3159012103fccff17371fb03621a0873eaff2f3d87cdb5fe36;
    bytes32 public constant TRUST_ACCOUNT_PAYMENT_HASH =      0xd2034e198b9eadf8e1cbe0748ea895a9b61c191942d760814bbf69b40433b55c;
    bytes32 public constant OPERATOR_ACCOUNT_PAYMENT_HASH =   0x5dfb70a859b83dcaee084a4338268940533335bc927474a5b53609d685025094;
    bytes32 public constant SETTLEMENT_ACCOUNT_PAYMENT_HASH = 0x5dfb70a859b83dcaee084a4338268940533335bc927474a5b53609d685025094;
    bytes32 public constant ADJUSTOR_ACCOUNT_PAYMENT_HASH =   0x5dfb70a859b83dcaee084a4338268940533335bc927474a5b53609d685025094;
}
