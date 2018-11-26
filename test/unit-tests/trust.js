/**
 * @description Unit tests for verifying Trust contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

// Load the java script files to access their functions
const expect = require('expect.js');
const bn = require('bignumber.js');
const miscFunc = require("../misc/miscFunc.js");
const setupI = require("../misc/setupI.js");
const td = require("../misc/testData.js");

// --- Solidity Contract Info ---
// contract Trust is IntAccessI, ExtAccessI
// event LogTrust(bytes32 indexed subject, address indexed adr, bytes32 indexed info, uint timestamp);
// ----------------

// initEcosystem(address _poolAdr, address _bondAdr, address _bankAdr, address _policyAdr, address _settlementAdr, address _adjustorAdr, address _timerAdr, bool _isWinterTime)
exports.verifyDeployedContracts = async () => {
    
    // Retrieve all the contract cross references as specified by the IntAccessI contract
    const poolAdrRef = await td.pool.getContractAdr();
    const bondAdrRef = await td.bond.getContractAdr();
    const bankAdrRef = await td.bank.getContractAdr();
    const policyAdrRef = await td.policy.getContractAdr();
    const settlementAdrRef = await td.settlement.getContractAdr();
    const adjustorAdrRef = await td.adjustor.getContractAdr();
    const timerAdrRef = await td.timer.getContractAdr();
    const trustAdrRef = await td.trust.getContractAdr();

    // Verify if all the contracts are cross referenced correctly (only point to each other)
    miscFunc.verifyAllContractReferenceAdr(0, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(1, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(2, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(3, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(4, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(5, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(6, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
    miscFunc.verifyAllContractReferenceAdr(7, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef);
}

// adjustDaylightSaving()
exports.adjustDaylightSaving = async () => {
    // Retrieve the value if it is summer or winter time
    const isWinterTime = await td.pool.isWinterTime();
    // Change the summer winter time
    const tx = await td.trust.adjustDaylightSaving({from: td.accounts[0]});
    
    // Verify the log entries in the pool
    if (isWinterTime == true)
        miscFunc.verifyPoolLog(tx, 0, 'ChangeToSummerTime', td.currentPoolDay, 0, null);
    else miscFunc.verifyPoolLog(tx, 0, 'ChangeToWinterTime', td.currentPoolDay, 0, null);

    // Verify the trust log entry
    miscFunc.verifyTrustLog(tx, 1, 'ChangeInDaylightSaving', td.accounts[0], miscFunc.getEmptyHash(), null);

    // Verify the log entries in the pool
    expect(await td.pool.daylightSavingScheduled()).to.be(true);
}