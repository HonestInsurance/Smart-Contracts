/**
 * @description Unit tests for verifying Pool contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

// Load the java script files to access their functions
const web3js = require('web3');
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
    const advanceTime = td.nextOvernightProcessingTimestamp + 
        setupI.POOL_DAILY_PROCESSING_OFFSET_SEC -
        ((await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp);
    // Call the blockchain to advance time
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_increaseTime', params: [advanceTime], id: 0}, () => { 
        // Mine another block
        web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_mine', params: [], id: 0}, () => { })
    });

    // Sleep for a 100 milli seconds to ensure the advancing of the time and mining of another block has been completed
    await miscFunc.sleep(5);

    // Get the value for wc expenses
    td.wc_exp_cu = (await td.pool.WC_Exp_Cu()).toNumber();
    // Get the yield before the processing and ensure it is at least the MIN YIELD value
    td.b_yield_ppb = Math.max((await td.pool.B_Yield_Ppb()).toNumber(), setupI.MIN_YIELD_PPB);
    
    // Set the next overnight processing (if it is daylight saving change nextOvernightProcessingTimestamp will be adjusted in the corresponding test function)
    td.nextOvernightProcessingTimestamp = +td.nextOvernightProcessingTimestamp + 86400;
    
    // Set yesterdayPoolDay and tomorrowPoolDay and increase currentPoolDay by 1
    const yesterdayPoolDay = td.currentPoolDay;
    const tomorrowPoolDay = td.currentPoolDay + 1;
    td.currentPoolDay++;
    
    // Value to save overwriteWcExpenses
    const overwriteWcExpenses = await td.pool.overwriteWcExpenses();
    // Get the count of the existing payment advice entries
    const firstOvernightPaymentAdviceEntryIdx = (await td.bank.countPaymentAdviceEntries()).toNumber();
    // Get the premium per risk point for yesterday
    const premium_yesterday_Cu = Math.floor(((await td.policy.premiumPerRiskPoint_Cu_Ppm(yesterdayPoolDay, 0)).toNumber()) * td.totalRiskPoints / Math.pow(10, 6));
    // Get the bank payments tracking value
    let bankPaymentsTracking = (await td.bank.fundingAccountPaymentsTracking_Cu()).toNumber();

    // Variables to store payment info
    let processingTrustAmount_Cu = 0;
    let processingPoolOperatorsAmount_Cu = 0;
    let processingOverflowAmount_Cu = 0;
    // Variable to store existing number of payment advice entries temporarily
    let newPaymentAdviceEntries = 0;
    
    // ********************************************************************************
    // *** Initiate overnight processing of the pool
    // ********************************************************************************
    
    const tx = await td.timer.manualPing(td.pool.address, 1, miscFunc.getEmptyAdr(), 0, {from: td.accounts[0]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // ********************************************************************************
    // *** (1) Process payments for yesterday (Premium, Pool operators and Trust)
    // ********************************************************************************

    // *** Adjust bank account balances if premium yesterday was paid
    if (premium_yesterday_Cu > 0) {
        // Decrease the balance in the premium acount
        td.wc_bal_pa_cu -= premium_yesterday_Cu;
        // Increase the account balance in the bond account
        td.wc_bal_ba_cu += premium_yesterday_Cu;
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

    // ********************************************************************************
    // *** (2) Process overflow payment for yesterday if applicable
    // ********************************************************************************

    // Call the function to calculate the average bond maturity per day and max bond slope per day
    const bondMaturityAverageMaxSlope_Cu = miscFunc.calculateAvgBondMaxBondSlope(tomorrowPoolDay, td.wc_bal_ba_cu);

    // If the average amount is greater than the max bond slope an overflow payment has happened
    if (bondMaturityAverageMaxSlope_Cu[0] > bondMaturityAverageMaxSlope_Cu[1]) {
        // Calculate the overflow amount
        processingOverflowAmount_Cu = +bondMaturityAverageMaxSlope_Cu[0] - +bondMaturityAverageMaxSlope_Cu[1];
        // An overflow payment has been made => Adjust the bank account banlances
        td.wc_bal_ba_cu -= processingOverflowAmount_Cu;
        td.wc_bal_fa_cu += processingOverflowAmount_Cu;
        // Increase the payment counter by 1
        newPaymentAdviceEntries++;
    }
    
    // ********************************************************************************
    // *** (3) RECALCULATION of tomorrow's insurance pool variables (IP Yield, IP Gradient, WC_BOND, WC_DELTA)
    // ********************************************************************************

    // *** Calculate the new value for working capital expenses if the overwrite flag has not been set
    if(overwriteWcExpenses == false) {
        td.wc_exp_cu = Math.floor((+td.wc_exp_cu * (+setupI.DURATION_WC_EXPENSE_HISTORY_DAYS - 1) / +setupI.DURATION_WC_EXPENSE_HISTORY_DAYS) + 
            +bankPaymentsTracking);
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

    // *** Calculate the GRADIENT
    if (td.wc_bond_cu > 0)
        td.b_gradient_ppq = Math.floor(td.b_yield_ppb * Math.pow(10, 6) / td.wc_bond_cu);
    else td.b_gradient_ppq = 0;

    // ********************************************************************************
    // *** (4) CALCULATION of tomorrow's insurance PREMIUM PER RISK POINT
    // ********************************************************************************

    // SOLIDITY code
        // // Tomorrows's total premium target is the greater value of the bond average or the max bond slope
        // uint totalPremiumTargetTomorrow_Cu = 
        // (_bondMaturityAverage_Cu > _bondMaturityMaxSlope_Cu ? _bondMaturityAverage_Cu : _bondMaturityMaxSlope_Cu);

        // // Calculate the tomorrows premium per risk point
        // uint tomorrowPremiumPerRiskPoint = 
        //     (totalIssuedPolicyRiskPoints > 0 ? (totalPremiumTargetTomorrow_Cu * (10**6))/totalIssuedPolicyRiskPoints : 0);

    // Set the premium target for tomorrow to the max value of average bond and max slope
    let totalPremiumTargetTomorrow_Cu = Math.max(bondMaturityAverageMaxSlope_Cu[0], bondMaturityAverageMaxSlope_Cu[1]);

    let premiumPerRiskPointTomorrow_Cu = 0;

    // premiumPerRiskPoint_Cu_Ppm[currentPoolDay] = (totalPremiumTargetToday_Cu * (10**6)) / totalPolicyRiskPoints;
    if (td.totalRiskPoints > 0)
        premiumPerRiskPointTomorrow_Cu = Math.floor((totalPremiumTargetTomorrow_Cu *  Math.pow(10, 6)) / td.totalRiskPoints);

    // Verify the calculated premiums per risk point for tomorrow are correct
    expect(premiumPerRiskPointTomorrow_Cu).to.be.equal((await td.policy.premiumPerRiskPoint_Cu_Ppm(tomorrowPoolDay, 0)).toNumber());


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
    miscFunc.verifyPoolLog(logs, 0, 'TotalRiskPoints', yesterdayPoolDay, td.totalRiskPoints, null);
    miscFunc.verifyPoolLog(logs, 1, 'PremiumCu', yesterdayPoolDay, premium_yesterday_Cu, null);

    let nextLogIdx = 2;
    // If overflow event was triggered check event
    if (processingOverflowAmount_Cu > 0) {
        miscFunc.verifyPoolLog(logs, 2, 'OverflowCu', yesterdayPoolDay, processingOverflowAmount_Cu, null);
        nextLogIdx = 3;
    }
    
    // Verify the event logs that were created as for today pool day
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 0, 'WcExpenseForecastCu', tomorrowPoolDay, td.wc_exp_cu, null);
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 1, 'WcBondCu', tomorrowPoolDay, td.wc_bond_cu, null);
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 2, 'BondGradientPpq', tomorrowPoolDay, td.b_gradient_ppq, null);
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 3, 'BondYieldPpb', tomorrowPoolDay, td.b_yield_ppb, null);
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 4, 'BondMaturityAverageCu', tomorrowPoolDay, bondMaturityAverageMaxSlope_Cu[0], null);
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 5, 'BondMaturityMaxSlopeCu', tomorrowPoolDay, bondMaturityAverageMaxSlope_Cu[1], null);
    miscFunc.verifyPoolLog(logs, +nextLogIdx + 6, 'PremiumPerRiskPointPpm', tomorrowPoolDay, premiumPerRiskPointTomorrow_Cu, null);

    // Verify current pool day is still 'yesterday' and has not changed
    expect(tomorrowPoolDay).to.be.equal((await td.pool.currentPoolDay()).toNumber());
    // Verify overwrite WC expenses is now set to false
    expect(false).to.be.equal(await td.pool.overwriteWcExpenses());
    // Verify premium account, bond account and funding account balances are correct
    expect(td.wc_bal_pa_cu).to.be.equal((await td.pool.WC_Bal_PA_Cu()).toNumber());
    expect(td.wc_bal_ba_cu).to.be.equal((await td.pool.WC_Bal_BA_Cu()).toNumber());
    expect(td.wc_bal_fa_cu).to.be.equal((await td.pool.WC_Bal_FA_Cu()).toNumber());

    // Verify the correct number of new payment advice entries have been created
    expect(+newPaymentAdviceEntries + +firstOvernightPaymentAdviceEntryIdx).to.be.equal((await td.bank.countPaymentAdviceEntries()).toNumber());

    // Verify the first payment advice (premium payment)
    if (newPaymentAdviceEntries >= 1) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(firstOvernightPaymentAdviceEntryIdx);
        expect(1).to.be.equal(paymentAdvice.adviceType.toNumber()); // "Premium payment advice type incorrect");
        expect(setupI.BOND_ACCOUNT_PAYMENT_HASH).to.be.equal(paymentAdvice.paymentAccountHashRecipient); // "Premium payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.equal(bn.BigNumber(paymentAdvice.paymentSubject).toNumber()); // "Premium payment reference incorrect");
        expect(premium_yesterday_Cu).to.be.equal(paymentAdvice.amount.toNumber()); // "Premium payment amount incorrect");
    }
    // Verify the second payment advice (trust payment)
    if (newPaymentAdviceEntries >= 2) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(+firstOvernightPaymentAdviceEntryIdx + 1);
        expect(6).to.be.equal(paymentAdvice.adviceType.toNumber()); // "Trust payment advice type incorrect");
        expect(setupI.TRUST_ACCOUNT_PAYMENT_HASH).to.be.equal(paymentAdvice.paymentAccountHashRecipient); // "Trust payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.equal(bn.BigNumber(paymentAdvice.paymentSubject).toNumber()); // "Trust payment reference incorrect");
        expect(processingTrustAmount_Cu).to.be.equal(paymentAdvice.amount.toNumber()); // "Trust payment amount incorrect");
    }
    // Verify the third payment advice (pool operator payment)
    if (newPaymentAdviceEntries >= 3) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(+firstOvernightPaymentAdviceEntryIdx + 2);
        expect(4).to.be.equal(paymentAdvice.adviceType.toNumber()); // "Pool operator payment advice type incorrect");
        expect(setupI.OPERATOR_ACCOUNT_PAYMENT_HASH).to.be.equal(paymentAdvice.paymentAccountHashRecipient); // "Pool operator payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.equal(bn.BigNumber(paymentAdvice.paymentSubject).toNumber()); // "Pool operator payment reference incorrect");
        expect(processingPoolOperatorsAmount_Cu).to.be.equal(paymentAdvice.amount.toNumber()); // "Pool operator payment amount incorrect");
    }
    // Verify the fourth payment advice (overflow payment)
    if (newPaymentAdviceEntries >= 4) {
        let paymentAdvice = await td.bank.bankPaymentAdvice(+firstOvernightPaymentAdviceEntryIdx + 3);
        expect(3).to.be.equal(paymentAdvice.adviceType.toNumber()); // "Overflow payment advice type incorrect");
        expect(setupI.FUNDING_ACCOUNT_PAYMENT_HASH).to.be.equal(paymentAdvice.paymentAccountHashRecipient); // "Overflow payment hash recipient incorrect");
        expect(yesterdayPoolDay).to.be.equal(bn.BigNumber(paymentAdvice.paymentSubject).toNumber()); // "Overflow payment reference incorrect");
        expect(processingOverflowAmount_Cu).to.be.equal(paymentAdvice.amount.toNumber()); // "Overflow payment amount incorrect");
    }
    
    // Call the blockchain to advance time by 8 hours 35 min
    web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_increaseTime', params: [30900], id: 0}, () => { 
        // Mine another block
        web3.currentProvider.send({jsonrpc: '2.0', method: 'evm_mine', params: [], id: 0}, () => { })
    });

    // Sleep for a 100 milli seconds to ensure the advancing of the time and mining of another block has been completed
    await miscFunc.sleep(5);
}

// dailyPolicyProcessing()
exports.dailyPolicyProcessing = async () => {
    // Call the timer to initiate the processing of the policies
    await td.timer.manualPing(td.policy.address, 0, miscFunc.getEmptyAdr(), 0, {from: td.accounts[0]});
    // Save the new value for the total issued policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();
}

// acceleratePoolYield()
exports.acceleratePoolYield = async (_intervals) => {
    // Get the yield before the processing
    let tempYield = (await td.pool.B_Yield_Ppb()).toNumber();
    // Save the current yield
    td.b_yield_ppb = tempYield;

    // Accellerate the yield if there is sufficient demand
    if (td.wc_bond_cu > ((td.wc_exp_cu * 24 * 3600 * setupI.YAC_EXPENSE_THRESHOLD_PPT) / ((setupI.DURATION_WC_EXPENSE_HISTORY_DAYS * 3600) * (Math.pow(10, 3))))) {
        // Accellerate the yield
        for (let i = 0; i < _intervals; i++) {
            await td.timer.manualPing(td.pool.address, 0, miscFunc.getEmptyAdr(), td.futureEpochTimeStamp, {from: td.accounts[0]});
            tempYield = Math.floor((tempYield * (Math.pow(10, 9) + setupI.YAC_PER_INTERVAL_PPB)) / Math.pow(10, 9));
        }
    }
    // Verify the new pool yield is correct
    expect(tempYield).to.be.equal((await td.pool.B_Yield_Ppb()).toNumber());
    // Save the new yield in testdata
    td.b_yield_ppb = tempYield;
}