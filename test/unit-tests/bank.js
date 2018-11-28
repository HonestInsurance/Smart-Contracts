/**
 * @description Unit tests for verifying Bank contract functions
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
const utBank = require("../unit-tests/bank.js");

// --- Solidity Contract Info ---
// contract Bank is IntAccessI, ExtAccessI
// event LogBank(bytes32 indexed internalReferenceHash, uint indexed accountType, bool indexed success, bytes32 paymentAccountHash, bytes32 paymentSubject, bytes32 info, uint timestamp, uint transactionType, uint amount);
// ----------------

// function processPaymentAdvice(uint _idx, uint _bankTransactionIdx)
async function processPaymentAdvice(_idx) {
    // Get the payment advice to be processed
    const paymentAdvice = await td.bank.bankPaymentAdvice(_idx);
    
    // If this particular payment advice entry has already been processed return
    if (paymentAdvice.amount.toNumber() == 0)
        return;

    // Increase the bank transaction idx
    td.bankTransactionIdx++;
    let expectedAccountType;
    // Extract the Account AccountType from the PaymentAdviceType
    if ((paymentAdvice.adviceType.toNumber() == 0) || (paymentAdvice.adviceType.toNumber() == 1))
        expectedAccountType = 0;
    else if ((paymentAdvice.adviceType.toNumber() == 2) || (paymentAdvice.adviceType.toNumber() == 3)) 
        expectedAccountType = 1;
    else expectedAccountType = 2;

    // Process the payment
    const tx = await td.bank.processPaymentAdvice(_idx, td.bankTransactionIdx, {from: td.accounts[0]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // Verify the bank transaction event details
    miscFunc.verifyBankLog(logs, 0, null, expectedAccountType, true, paymentAdvice.paymentAccountHashRecipient,
        paymentAdvice.paymentSubject, null, null, 1, paymentAdvice.amount.toNumber());

    // If it is an internal payment execute the DEPOSIT transaction
    if ((paymentAdvice.adviceType.toNumber() == 1) || (paymentAdvice.adviceType.toNumber() == 3)) {
        // Execute the deposit
        const logs = await utBank.processAccountCredit(
            paymentAdvice.adviceType.toNumber() == 1 ? 1 : 2,      // Account type
            paymentAdvice.adviceType.toNumber() == 1 ? setupI.PREMIUM_ACCOUNT_PAYMENT_HASH : setupI.BOND_ACCOUNT_PAYMENT_HASH,      // Hash sender
            paymentAdvice.paymentSubject,            // Payment Subject 
            paymentAdvice.amount.toNumber(),         // Amount
            true,
            web3.utils.padRight(web3.utils.toHex("Pool"), 64), 
            '');

        // Adjust (WC_Bal_BA_Cu, WC_BAL_FA_CU)
        if (paymentAdvice.adviceType.toNumber() == 1)
            td.wc_bal_ba_cu = +td.wc_bal_ba_cu + +paymentAdvice.amount.toNumber();
        else td.wc_bal_fa_cu = +td.wc_bal_fa_cu + +paymentAdvice.amount.toNumber();
        
        // Verify if WC_Bal_FA_Cu and WC_Bal_BA_Cu are correct
        expect(td.wc_bal_ba_cu).to.be.eql((await td.pool.WC_Bal_BA_Cu()).toNumber());
        expect(td.wc_bal_fa_cu).to.be.eql((await td.pool.WC_Bal_FA_Cu()).toNumber());
    }
}

// function processes all outstanding bank payment advice entries
exports.processAllOutstandginPaymentAdvice = async () => {
    // Get the total number of payment advice entries
    const count = (await td.bank.countPaymentAdviceEntries()).toNumber();
    // Run throught all potential outstanding paymend advice entries and submitt for processing
    for (let i=0; i<count; i++) {
        await processPaymentAdvice(i);
    }
}

// function processAccountCredit(uint _bankTransactionIdx, uint _accountType, bytes32 _paymentAccountHashSender, bytes32 _paymentSubject, uint _bankCreditAmount_Cu)
exports.processAccountCredit = async (_accountType, _paymentAccountHashSender, _paymentSubject, _bankCreditAmount_Cu, _expectedSuccess, _expectedHash, _expectedInfo) => {
    // Increase the bankTransactionIdx
    td.bankTransactionIdx++;
    // Process the deposit
    const tx = await td.bank.processAccountCredit(td.bankTransactionIdx, _accountType, _paymentAccountHashSender, 
        _paymentSubject, _bankCreditAmount_Cu, {from: td.accounts[0]});
        // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);
       
    // Verify how many events were triggert (the bank transaction log events are always triggered last)
    let eventIdx = logs.length - 1;
    if (_expectedSuccess == false)
        eventIdx--;

    // Verify the bank transaction logs
    miscFunc.verifyBankLog(logs, eventIdx, _expectedHash, _accountType, _expectedSuccess, _paymentAccountHashSender,
        _paymentSubject, _expectedInfo, null, 0, _bankCreditAmount_Cu);

    if (_expectedSuccess == false) {
        // Increase the event Idx
        eventIdx++;
        // Check the event details of the refund operation
        miscFunc.verifyBankLog(logs, eventIdx, null, _accountType, true, _paymentAccountHashSender,
            _paymentSubject, _expectedInfo, null, 1, _bankCreditAmount_Cu);
    }
    
    // Verify the bank transaction flag for the specified transaction idx is set to true
    expect(true).to.be.eql(await td.bank.bankTransactionIdxProcessed(td.bankTransactionIdx));
    // Return the transaction result
    return logs;
}

// function processes a credit into the Funding account (i.e. a bond credit)
exports.bondPrincipalCredit = async (_bondHash) => {
    // Get the bond details
    const initialBondData = await td.bond.dataStorage(_bondHash);
    // Variable to store the bond principal
    const bondPrincipal = initialBondData.principal_Cu.toNumber();
    // Variable to store the final bond yield (if applicable)
    let finalBondYield = 0;

    // Process the bank deposit
    const logs = await utBank.processAccountCredit(2, web3.utils.sha3(_bondHash), _bondHash, bondPrincipal, true, _bondHash, '');
    
    // If bond was in a created state => Calculate the final bond yield, update pool variables and check event info
    if (initialBondData.state.toNumber() == 0) {
        // Calcuate the expected yield average
        const yieldAvg = Math.floor((td.b_gradient_ppq * bondPrincipal) / (2 * (Math.pow(10, 6))));
        // Calculate the final and expected bond yield
        finalBondYield = Math.max(setupI.MIN_YIELD_PPB, +td.b_yield_ppb - +yieldAvg);
        // Calculate the final and expected pool yield
        td.b_yield_ppb = Math.max(setupI.MIN_YIELD_PPB, +td.b_yield_ppb - (2 * +yieldAvg));

        // Adjust wc_bond_cu
        td.wc_bond_cu = +td.wc_bond_cu - +bondPrincipal;

        // Event 0 - Bond is secured with Bond Principal
        miscFunc.verifyBondLog(logs, 0, _bondHash, initialBondData.owner, bondPrincipal, null, 1);
        // Event 1 - Bond signing
        miscFunc.verifyBondLog(logs, 1, _bondHash, initialBondData.owner, finalBondYield, null, 3);
        // Event 2 - Bond active
        miscFunc.verifyBondLog(logs, 2, _bondHash, initialBondData.owner, initialBondData.maturityDate.toNumber(), null, 4);
    }
    else {
        // If bond was SecuredReferenceBond (was in a Signed state before the bank transaction) the security bond event need to be verified
        // Event 0 - Bond that is providing the underwriting is active again
        miscFunc.verifyBondLog(logs, 0, initialBondData.securityReferenceHash, initialBondData.owner, null, null, 4);
        // Event 2 - Bond active
        miscFunc.verifyBondLog(logs, 1, _bondHash, initialBondData.owner, initialBondData.maturityDate.toNumber(), null, 4);
        
        // Reduce WC_Transit_Cu as bond was secured by another bond
        td.wc_transit_cu = +td.wc_transit_cu - +bondPrincipal;
        // Safe the final bond yield
        finalBondYield = initialBondData.yield_Ppb.toNumber();
    }
    
    // Adjust WC_Bal_FA_Cu
    td.wc_bal_fa_cu = +td.wc_bal_fa_cu + +bondPrincipal;

    // Calculate the maturity payout amount
    const maturityPayoutAmount = +bondPrincipal + Math.floor(+bondPrincipal * +finalBondYield / Math.pow(10, 9));

    // Increase the bond maturity payout for the future day
    const futureBondMaturityDay = +Math.floor(setupI.DURATION_TO_BOND_MATURITY_SEC / 86400) + +td.currentPoolDay;
    // If the value is null set it to 0 first
    if (td.bondMaturityPayoutsEachDay[futureBondMaturityDay] == null)
        td.bondMaturityPayoutsEachDay[futureBondMaturityDay] = 0;
    // Add the bond maturity payout amount to the day
    td.bondMaturityPayoutsEachDay[futureBondMaturityDay] += +maturityPayoutAmount;

    // Call the function to verify all bond data
    await miscFunc.verifyBondData(await td.bond.dataStorage(_bondHash), null, null, 
        null, null, finalBondYield, maturityPayoutAmount, null, null, null, 4, miscFunc.getEmptyHash());

    // Verify if WC_Bal_FA_Cu and WC_Transit are correct
    expect(td.wc_bal_fa_cu).to.be.eql((await td.pool.WC_Bal_FA_Cu()).toNumber());
    expect(td.wc_transit_cu).to.be.eql((await td.pool.WC_Transit_Cu()).toNumber());
    
    // Get the bond data of the securing bond if applicable (bond was in signed state)
    if (initialBondData.state.toNumber() == 3) {
        // The state of the underwriting bond needs to be Issued (4) and reference to bond needs to be removed 0x0
        await miscFunc.verifyBondData((await td.bond.dataStorage(initialBondData.securityReferenceHash)), null, null, null, null, null, null, null, null, null, 4, miscFunc.getEmptyHash());
    }
}

// function processes a credit into the Premium account (i.e. a policy credit)
exports.policyPremiumCredit = async (_policyHash, _amount_cu) => {
    // Save the policy data
    let initialPolicyData = await td.policy.dataStorage(_policyHash);
    
    // Get the current total policy risk points
    td.totalRiskPoints = (await td.policy.totalIssuedPolicyRiskPoints()).toNumber();

    // Process the bank deposit
    const logs = await utBank.processAccountCredit(0, web3.utils.sha3(_policyHash), _policyHash, _amount_cu, true, _policyHash, '');

    // Adjust WC_Bal_PA_Cu
    td.wc_bal_pa_cu = +td.wc_bal_pa_cu + +_amount_cu;
    
    // If the policy is in a paused state and this is the first ever credit to this policy
    if ((initialPolicyData.state.toNumber() == 0) &&  (initialPolicyData.premiumCredited_Cu.toNumber() == 0)) {
        // Verify the policy event log
        miscFunc.verifyPolicyLog(logs, 0, _policyHash, initialPolicyData.owner, miscFunc.getEmptyHash(), null, 1);
        // Add the risk points
        td.totalRiskPoints = +td.totalRiskPoints + +initialPolicyData.riskPoints.toNumber();
        // Change the expected policy's state to issued (1)
        initialPolicyData.state = 1;
        // Change the last reconciliation day to today
        initialPolicyData.lastReconciliationDay = td.currentPoolDay;
    }
    // If the state of the Policy was Lapsed
    else if (initialPolicyData.state.toNumber() == 2) {
        // Verify the policy event log
        miscFunc.verifyPolicyLog(logs, 0, _policyHash, initialPolicyData[1], miscFunc.getEmptyHash(), null, 3);
        // Change the expected policy's state to post lapsed (3)
        initialPolicyData.state = 3;
        // Change the last reconciliation day to today
        initialPolicyData.lastReconciliationDay = td.currentPoolDay;
    }

    // If the state of the Policy is Issued
    if (Number(initialPolicyData.state) == 1) {
        // Change the last reconciliation day to today
        initialPolicyData.lastReconciliationDay = td.currentPoolDay;
    }

    // Adjust the premiumDeposited amount
    initialPolicyData.premiumCredited_Cu = +initialPolicyData.premiumCredited_Cu.toNumber() + +_amount_cu;

    // Verify the new policy data
    miscFunc.verifyPolicyData((await td.policy.dataStorage(_policyHash)), initialPolicyData.idx.toNumber(), initialPolicyData.owner, null, null, initialPolicyData.riskPoints.toNumber(), 
        Number(initialPolicyData.premiumCredited_Cu), null, Number(initialPolicyData.state), Number(initialPolicyData.lastReconciliationDay), null);

    // Verify the new balance for wc_bal_pa_cu in pool is valid and the total number of Risk points in the policy contract is correct
    expect(td.wc_bal_pa_cu).to.be.eql((await td.pool.WC_Bal_PA_Cu()).toNumber());
    expect(td.totalRiskPoints).to.be.eql((await td.policy.totalIssuedPolicyRiskPoints()).toNumber());
}