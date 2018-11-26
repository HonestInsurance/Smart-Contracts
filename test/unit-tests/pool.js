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
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // Verify Event 0
    miscFunc.verifyPoolLog(logs, 0, 'WcExpensesAdjustmentCu', td.currentPoolDay, td.wc_exp_cu, null);
    
    // Verify the new value for wc expenses set in the pool
    expect((await td.pool.WC_Exp_Cu()).toNumber()).to.be.equal(td.wc_exp_cu);
    // Verify the overwrite flag is set
    expect(await td.pool.overwriteWcExpenses()).to.be.equal(true);
}

// dailyOvernightProcessing()
exports.dailyOvernightProcessing = async () => {
    // Accellerate the blockchain time to midnight + setupI.POOL_DAILY_PROCESSING_OFFSET_SEC
    const advanceTime = +td.nextOvernightProcessingTimestamp + 
        +setupI.POOL_DAILY_PROCESSING_OFFSET_SEC - 
        +web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    // Call the blockchain to advance time
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [advanceTime], id: 0});

    // Get the value for wc expenses
    td.wc_exp_cu = (await td.pool.WC_Exp_Cu()).valueOf();
    // Get the yield before the processing and ensure it is at least the MIN YIELD value
    td.b_yield_ppb = Math.max((await td.pool.B_Yield_Ppb()).valueOf(), setupI.MIN_YIELD_PPB);
    
    // Set the next overnight processing (if it is daylight saving change nextOvernightProcessingTimestamp will be adjusted in the corresponding test function)
    td.nextOvernightProcessingTimestamp = +td.nextOvernightProcessingTimestamp + 86400;
    // Increase the current pool day
    td.currentPoolDay++;

    // Set the yesterdayPoolDay
    const yesterdayPoolDay = +td.currentPoolDay - 1;
    
    // Get Bond maturity payout for next 3 days and future per day
    const bondMaturityPayoutAmountNext3Days_Cu = miscFunc.getBondMaturityPaymentsNext3Days();
    const bondMaturityPayoutFuturePerDay_Cu = miscFunc.getBondMaturityPaymentsAveragePerDay();

    // Value to save overwriteWcExpenses
    const overwriteWcExpenses = await td.pool.overwriteWcExpenses();
    // Get the count of the existing payment advice entries
    const firstOvernightPaymentAdviceEntryIdx = (await td.bank.countPaymentAdviceEntries()).valueOf();
    // Get the premium per risk point for yesterday
    const premium_yesterday_Cu = Math.floor(((await td.policy.premiumPerRiskPoint_Cu_Ppm(yesterdayPoolDay, 0)).valueOf()) * td.totalRiskPoints / Math.pow(10, 6));
    // Get the bank payments tracking value
    let bankPaymentsTracking = (await td.bank.fundingAccountPaymentsTracking_Cu()).valueOf();

    // Variables to store payment info
    let processingTrustAmount_Cu = 0;
    let processingPoolOperatorsAmount_Cu = 0;
    let processingOverflowAmount_Cu = 0;
    // Variable to store existing number of payment advice entries temporarily
    let newPaymentAdviceEntries = 0;
    
    // Initiate overnight processing of the pool
    const tx = await td.timer.manualPing(td.pool.address, 1, 0x0, 0, {from: td.accounts[0]});

    // *** Adjust bank account balances if premium yesterday was paid
    if (premium_yesterday_Cu > 0) {
        td.wc_bal_pa_cu -= premium_yesterday_Cu;
        newPaymentAdviceEntries++;

        processingTrustAmount_Cu = Math.floor((premium_yesterday_Cu * setupI.TRUST_FEE_PPT) / Math.pow(10, 3));
        if (processingTrustAmount_Cu >= 1) {
            td.wc_bal_fa_cu -= processingTrustAmount_Cu;
            bankPaymentsTracking = +bankPaymentsTracking + +processingTrustAmount_Cu;
            newPaymentAdviceEntries++;
        }
        
        processingPoolOperatorsAmount_Cu = Math.floor((premium_yesterday_Cu * setupI.POOL_OPERATOR_FEE_PPT) / Math.pow(10, 3));
        if (processingPoolOperatorsAmount_Cu >= 1) {
            td.wc_bal_fa_cu -= processingPoolOperatorsAmount_Cu;
            bankPaymentsTracking = +bankPaymentsTracking + +processingPoolOperatorsAmount_Cu;
            newPaymentAdviceEntries++;
        }
    }

    // Calculate the new value for working capital expenses if the overwrite flag has not been set
    // Get the expense forecast for the new day
    // Solidity code
    // WC_Exp_Cu = ((WC_Exp_Cu * (DURATION_WC_EXPENSE_HISTORY_DAYS - 1)) / DURATION_WC_EXPENSE_HISTORY_DAYS) + 
    //         Bank(getBankAdr()).getResetFundingAccountPaymentsTracking();

    if(overwriteWcExpenses == false) {
        td.wc_exp_cu = Math.floor((+td.wc_exp_cu * (+setupI.DURATION_WC_EXPENSE_HISTORY_DAYS - 1) / +setupI.DURATION_WC_EXPENSE_HISTORY_DAYS) + 
            +bankPaymentsTracking);
    }

    //console.log('Pool: ' + processingPoolOperatorsAmount_Cu + '   Trust: ' + processingTrustAmount_Cu + '   Total: ' + bankPaymentsTracking);

    // *** Adjust bank account balances if an overflow payment has occured
    if (td.wc_bal_ba_cu > 5 * bondMaturityPayoutFuturePerDay_Cu) {
        processingOverflowAmount_Cu = td.wc_bal_ba_cu - (5 * bondMaturityPayoutFuturePerDay_Cu);
        td.wc_bal_ba_cu -= processingOverflowAmount_Cu;
        // Increase the payment counter by 1
        newPaymentAdviceEntries++;
    }

    // *** Calculate WC BOND Cu
    if (td.wc_exp_cu > 0) {
        // Solidity code for wc_time
        // WC_Time = (int(WC_Bal_FA_Cu - WC_Locked_Cu) * int(setupI.DURATION_WC_EXPENSE_HISTORY_DAYS * 86400)) / int(WC_Exp_Cu);
        const wc_time = Math.floor(((td.wc_bal_fa_cu - td.wc_locked_cu) * (setupI.DURATION_WC_EXPENSE_HISTORY_DAYS * 86400)) / (td.wc_exp_cu));
        // Solidity code for wc_delta_cu
        // int WC_Delta_Cu = ((int(setupI.WC_POOL_TARGET_TIME_SEC) - WC_Time) * int(WC_Exp_Cu)) / int(setupI.DURATION_WC_EXPENSE_HISTORY_DAYS * 86400);
        const wc_delta_cu = Math.floor(((setupI.WC_POOL_TARGET_TIME_SEC - wc_time) * td.wc_exp_cu) / (setupI.DURATION_WC_EXPENSE_HISTORY_DAYS * 86400));
        // Verfy if wc_bond is positive
        if (wc_delta_cu - td.wc_transit_cu > 0)
            td.wc_bond_cu = wc_delta_cu - td.wc_transit_cu;
        else td.wc_bond_cu = 0;
    }
    else {
        td.wc_bond_cu = 0;
    }

    // *** Calculate the PREMIUM PER RISK POINT TODAY
    let totalPremiumTargetToday_Cu = 0;
    let premiumPerRiskPoint_Cu = 0;

    // SOLIDITY code
    // if (bondMaturityPayoutAmountNext3Days_Cu - WC_Bal_BA_Cu - totalPremiumYesterday_Cu > bondMaturityPayoutFuturePerDay_Cu)
    //     totalPremiumTargetToday_Cu = bondMaturityPayoutAmountNext3Days_Cu - WC_Bal_BA_Cu - totalPremiumYesterday_Cu;
    // else totalPremiumTargetToday_Cu = bondMaturityPayoutFuturePerDay_Cu;

    if (bondMaturityPayoutAmountNext3Days_Cu - td.wc_bal_ba_cu - premium_yesterday_Cu > bondMaturityPayoutFuturePerDay_Cu)
        totalPremiumTargetToday_Cu = +bondMaturityPayoutAmountNext3Days_Cu - +td.wc_bal_ba_cu - premium_yesterday_Cu;
    else totalPremiumTargetToday_Cu = bondMaturityPayoutFuturePerDay_Cu;

    // SOLIDITY code
    // premiumPerRiskPoint_Cu_Ppm[currentPoolDay] = (totalPremiumTargetToday_Cu * (10**6)) / totalPolicyRiskPoints;
    if (td.totalRiskPoints > 0)
        premiumPerRiskPoint_Cu = Math.floor((totalPremiumTargetToday_Cu *  Math.pow(10, 6)) / td.totalRiskPoints);

    // *** Calculate the GRADIENT
    if (td.wc_bond_cu > 0)
        td.b_gradient_ppq = Math.floor(td.b_yield_ppb * Math.pow(10, 6) / td.wc_bond_cu);
    else td.b_gradient_ppq = 0;
    

    // SOLIDITY CODE - Verify all the events that were triggered with
    // 0 LogPool(bytes32("TotalRiskPoints"), address(yesterdayPoolDay), bytes32(totalPolicyRiskPoints), now);
    // 1 LogPool(bytes32("PremiumCu"), address(yesterdayPoolDay), bytes32(totalPremiumYesterday_Cu), now);
    // 2 LogPool(bytes32("OverflowCu"), address(yesterdayPoolDay), bytes32(overflowAmount_Cu), now);

    // 0 LogPool(bytes32("WcExpenseForecastCu"), address(currentPoolDay), bytes32(WC_Exp_Cu), now);
    // 1 LogPool(bytes32("WcBondCu"), address(currentPoolDay), bytes32(WC_Bond_Cu), now);
    // 2 LogPool(bytes32("BondGradientPpq"), address(currentPoolDay), bytes32(B_Gradient_Ppq), now);
    // 3 LogPool(bytes32("BondYieldPpb"), address(currentPoolDay), bytes32(B_Yield_Ppb), now);
    // 4 LogPool(bytes32("BondPayoutNext3DaysCu"), address(currentPoolDay), bytes32(bondMaturityPayoutAmountNext3Days_Cu), now);
    // 5 LogPool(bytes32("BondPayoutFutureCu"), address(currentPoolDay), bytes32(bondMaturityPayoutFuturePerDay_Cu), now);
    // 6 LogPool(bytes32("PremiumPerRiskPointPpm"), address(currentPoolDay), bytes32(premiumPerRiskPoint_Cu_Ppm[currentPoolDay]), now);

    // Check the events for yesterday pool day
    miscFunc.verifyPoolLog(tx, 0, 'TotalRiskPoints', yesterdayPoolDay, td.totalRiskPoints, null);
    miscFunc.verifyPoolLog(tx, 1, 'PremiumCu', yesterdayPoolDay, premium_yesterday_Cu, null);

    let nextLogIdx = 2;
    // If overflow event was triggered check event
    if (processingOverflowAmount_Cu > 0) {
        miscFunc.verifyPoolLog(tx, 2, 'OverflowCu', yesterdayPoolDay, processingOverflowAmount_Cu, null);
        nextLogIdx = 3;
    }
    
    // Verify the event logs that were created as for today pool day
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 0, 'WcExpenseForecastCu', td.currentPoolDay, td.wc_exp_cu, null);
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 1, 'WcBondCu', td.currentPoolDay, td.wc_bond_cu, null);
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 2, 'BondGradientPpq', td.currentPoolDay, td.b_gradient_ppq, null);
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 3, 'BondYieldPpb', td.currentPoolDay, td.b_yield_ppb, null);
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 4, 'BondPayoutNext3DaysCu', td.currentPoolDay, bondMaturityPayoutAmountNext3Days_Cu, null);
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 5, 'BondPayoutFutureCu', td.currentPoolDay, bondMaturityPayoutFuturePerDay_Cu, null);
    miscFunc.verifyPoolLog(tx, +nextLogIdx + 6, 'PremiumPerRiskPointPpm', td.currentPoolDay, premiumPerRiskPoint_Cu, null);

    // Verify current pool day is still 'yesterday' and has not changed
    expect(td.currentPoolDay).to.be.eql((await td.pool.currentPoolDay()).valueOf());
    // Verify overwrite WC expenses is now set to false
    expect(false).to.be.eql(td.pool.overwriteWcExpenses());
    // Verify premium account, bond account and funding account balances are correct
    expect(td.wc_bal_pa_cu).to.be.eql((await td.pool.WC_Bal_PA_Cu()).valueOf());
    expect(td.wc_bal_ba_cu).to.be.eql((await td.pool.WC_Bal_BA_Cu()).valueOf());
    expect(td.wc_bal_fa_cu).to.be.eql((await td.pool.WC_Bal_FA_Cu()).valueOf());

    // Verify the correct number of new payment advice entries have been created
    expect(+newPaymentAdviceEntries + +firstOvernightPaymentAdviceEntryIdx).to.be.eql((await td.bank.countPaymentAdviceEntries()).valueOf());

    // Verify the first payment advice (premium payment)
    if (newPaymentAdviceEntries >= 1) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(firstOvernightPaymentAdviceEntryIdx);
        expect(1).to.be.eql(paymentAdvice[0].valueOf()); // "Premium payment advice type incorrect");
        expect(setupI.BOND_ACCOUNT_PAYMENT_HASH).to.be.eql(paymentAdvice[1].valueOf()); // "Premium payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.eql(paymentAdvice[2].valueOf()); // "Premium payment reference incorrect");
        expect(premium_yesterday_Cu).to.be.eql(paymentAdvice[3].valueOf()); // "Premium payment amount incorrect");
    }
    // Verify the second payment advice (trust payment)
    if (newPaymentAdviceEntries >= 2) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(+firstOvernightPaymentAdviceEntryIdx + 1);
        expect(6).to.be.eql(paymentAdvice[0].valueOf()); // "Trust payment advice type incorrect");
        expect(setupI.TRUST_ACCOUNT_PAYMENT_HASH).to.be.eql(paymentAdvice[1].valueOf()); // "Trust payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.eql(paymentAdvice[2].valueOf()); // "Trust payment reference incorrect");
        expect(processingTrustAmount_Cu).to.be.eql(paymentAdvice[3].valueOf()); // "Trust payment amount incorrect");
    }
    // Verify the third payment advice (pool operator payment)
    if (newPaymentAdviceEntries >= 3) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(+firstOvernightPaymentAdviceEntryIdx + 2);
        expect(4).to.be.eql(paymentAdvice[0].valueOf()); // "Pool operator payment advice type incorrect");
        expect(setupI.OPERATOR_ACCOUNT_PAYMENT_HASH).to.be.eql(paymentAdvice[1].valueOf()); // "Pool operator payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.eql(paymentAdvice[2].valueOf()); // "Pool operator payment reference incorrect");
        expect(processingPoolOperatorsAmount_Cu).to.be.eql(paymentAdvice[3].valueOf()); // "Pool operator payment amount incorrect");
    }
    // Verify the fourth payment advice (overflow payment)
    if (newPaymentAdviceEntries >= 4) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(+firstOvernightPaymentAdviceEntryIdx + 3);
        expect(3).to.be.eql(paymentAdvice[0].valueOf()); // "Overflow payment advice type incorrect");
        expect(setupI.FUNDING_ACCOUNT_PAYMENT_HASH).to.be.eql(paymentAdvice[1].valueOf()); // "Overflow payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.eql(paymentAdvice[2].valueOf()); // "Overflow payment reference incorrect");
        expect(processingOverflowAmount_Cu).to.be.eql(paymentAdvice[3].valueOf()); // "Overflow payment amount incorrect");
    }
    // Call the blockchain to advance time by 8 hours 35 min
    web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [30900], id: 0});
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