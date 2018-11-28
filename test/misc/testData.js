/**
 * @description Variables to store test data during test execution
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */


// Store the pre-loaded accounts that hold ether for submitting transactions
exports.accounts;

// The contract instances of the deployed solidity contracts
exports.pool;
exports.bond;
exports.bank;
exports.policy;
exports.settlement;
exports.adjustor;
exports.timer;
exports.trust;

// The event log file abi decoder object for all smart contract event log files
exports.abiDecoder;

// Arrays to store the bond, adjustor, settlement and policy hashes
exports.bHash = [];
exports.aHash = [];
exports.sHash = [];
exports.pHash = [];

// Unique bank transaction idx to be provided from the bank (used to avioid double processing)
exports.bankTransactionIdx = 5000;
// future timestamp epoch
exports.futureEpochTimeStamp = 2000000000;
// Initial overnight processing timestamp (midnight)
exports.nextOvernightProcessingTimestamp = 0;
// Variable to save the bond maturity payout dates required for overnight processing
exports.bondMaturityPayoutsEachDay = [];

// Store the current pool day
exports.currentPoolDay = 0;
// Store the total number of active risk points in the pool
exports.totalRiskPoints = 0;

// Bank account balances
exports.wc_bal_pa_cu = 0;
exports.wc_bal_ba_cu = 0;
exports.wc_bal_fa_cu = 0;

// Pool variables
exports.wc_bond_cu = 0;
exports.b_yield_ppb = 0;
exports.b_gradient_ppq = 0;
exports.wc_exp_cu = 0;
exports.wc_locked_cu = 0
exports.wc_transit_cu = 0;