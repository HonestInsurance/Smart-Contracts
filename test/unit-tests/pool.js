/**
 * @description Unit tests for verifying Pool contract functions
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
// contract Pool is SetupI, IntAccessI, NotificationI
// event LogPool(bytes32 indexed subject, address indexed adr, bytes32 indexed info, uint timestamp);
// ----------------

// setWcExpenses(uint _wcExpenses_Cu)
exports.setWcExpenses = async (_wcExpensesPerDay_Cu) => {
    // If an invalid number for _wcExpensesPerDay_Cu has been provided return
    if (_wcExpensesPerDay_Cu == null) 
        return;
    
    // Calculate and save the expenses to set wcExpenses to
    td.wc_exp_cu = (setupI.DURATION_WC_EXPENSE_HISTORY_DAYS) * _wcExpensesPerDay_Cu;     // 1000.00 per day
    // Update wc expenses in the pool
    const tx = await td.trust.setWcExpenses(td.wc_exp_cu, {from: td.accounts[0]});

    // Verify the event details for the pool day and wc expenses are correct
    expect(td.currentPoolDay).to.be.eql(miscFunc.eventLog('Pool', tx, 0, 1));
    expect(td.wc_exp_cu).to.be.eql(miscFunc.eventLog('Pool', tx, 0, 2));
    
    // Verify the new value for wc expenses set in the pool
    expect(td.wc_exp_cu).to.be.eql((await td.pool.WC_Exp_Cu()).valueOf());
    // Verify the overwrite flag is set
    expect(true).to.be.eql(await td.pool.overwriteWcExpenses());
}

// dailyOvernightProcessing()
exports.dailyOvernightProcessing = async () => {
    // *****************************************************
    // This code base has been removed and will be published at a later stage.
    // See release notes for further details.
    // *****************************************************
}

// dailyPolicyProcessing()
exports.dailyPolicyProcessing = async () => {
    // Call the timer to initiate the processing of the policies
    await td.timer.manualPing(td.policy.address, 0, 0, 0, {from: td.accounts[0]});
    // Save the new value for the total issued policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).valueOf();
}

// acceleratePoolYield()
exports.acceleratePoolYield = async (_intervals) => {
    // Get the yield before the processing
    let tempYield = (await td.pool.B_Yield_Ppb()).valueOf();
    // Save the current yield
    td.b_yield_ppb = tempYield;

    // Accellerate the yield if there is sufficient demand
    if (td.wc_bond_cu > ((td.wc_exp_cu * 24 * 3600 * setupI.YAC_EXPENSE_THRESHOLD_PPT) / ((setupI.DURATION_WC_EXPENSE_HISTORY_DAYS * 3600) * (Math.pow(10, 3))))) {
        // Accellerate the yield
        for (let i = 0; i < _intervals; i++) {
            await td.timer.manualPing(td.pool.address, 0, 0x0, td.futureEpochTimeStamp, {from: td.accounts[0]});
            tempYield = Math.floor((tempYield * (Math.pow(10, 9) + setupI.YAC_PER_INTERVAL_PPB)) / Math.pow(10, 9));
        }
    }
    // Verify the new pool yield is correct
    expect(tempYield).to.be.eql((await td.pool.B_Yield_Ppb()).valueOf());
    // Save the new yield in testdata
    td.b_yield_ppb = tempYield;
}

