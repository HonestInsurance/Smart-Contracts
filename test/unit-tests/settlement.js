/**
 * @description Unit tests for verifying Settlement contract functions
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
// contract Settlement is SetupI, IntAccessI {
// event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
// ----------------

// createSettlement(bytes32 _adjustorHash, bytes32 _policyHash, bytes32 _documentHash)
exports.createSettlement = async (_adjustorIdx, _policyHash, _documentHash) => {
    // Store the hash map info for now
    const settlementHashMapInfo = await td.settlement.hashMap();
    // Create a new Settlement via the Settlement contract signing with the Adjustor's private key
    const tx = await td.settlement.createSettlement(td.aHash[_adjustorIdx], _policyHash, _documentHash, {from: td.accounts[_adjustorIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // Get the settlement hash
    const settlementHash = miscFunc.verifySettlementLog(logs, 0);
    // Save the settlement hash
    td.sHash[settlementHashMapInfo.nextIdx.toNumber()] = settlementHash;
    
    // Event 0 - Settlement creation
    miscFunc.verifySettlementLog(logs, 0, settlementHash, td.aHash[_adjustorIdx], _policyHash, null, 0);

    // Event 1 - If a settlement document has been added
    if (_documentHash != miscFunc.getEmptyHash())
        miscFunc.verifySettlementLog(logs, 1, settlementHash, td.aHash[_adjustorIdx], _documentHash, null, 1);
      
    // Call the function to verify all settlement data
    await miscFunc.verifySettlementData(await td.settlement.dataStorage.call(settlementHash), settlementHashMapInfo.nextIdx.toNumber(), 0, (_documentHash == miscFunc.getEmptyHash() ? 0 : 1));
    
    // Verify the settlement has been added to the hash map
    miscFunc.verifyHashMap(settlementHashMapInfo, await td.settlement.hashMap(), true);
}

// addSettlementInfo(bytes32 _settlementHash, bytes32 _adjustorHash, bytes32 _documentHash) 
exports.addSettlementInfo = async (_settlementIdx, _adjustorIdx, _documentHash) => {
    // Add document hash to the specified settlement
    const tx = await td.settlement.addSettlementInfo(td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _documentHash, {from: td.accounts[_adjustorIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);
    // Verify event 0
    miscFunc.verifySettlementLog(logs, 0, td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _documentHash, null, 1);
}

// setExpectedSettlementAmount(bytes32 _settlementHash, bytes32 _adjustorHash, uint _expectedSettlementAmount) 
exports.setExpectedSettlementAmount = async (_settlementIdx, _adjustorIdx, _amount_cu) => {
    // Get the settlement details
    const settlementData = await td.settlement.dataStorage(td.sHash[_settlementIdx]);
    const wc_locked_before = (await td.pool.WC_Locked_Cu()).toNumber();

    // Set the expected settlement amount for the settlement
    await td.settlement.setExpectedSettlementAmount(td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _amount_cu, {from: td.accounts[_adjustorIdx]});
    // Verify new settlement data
    await miscFunc.verifySettlementData(await td.settlement.dataStorage.call(td.sHash[_settlementIdx]), _settlementIdx, _amount_cu, null);

    // Verify the new value for wc locked
    const wcLockedAmount_New = +wc_locked_before + (+_amount_cu - +settlementData[1].toNumber());
    expect((await td.pool.WC_Locked_Cu()).toNumber()).to.be.equal(wcLockedAmount_New);
}

// closeSettlement(bytes32 _settlementHash, bytes32 _adjustorHash, bytes32 _documentHash, uint _settlementAmount) 
exports.closeSettlement = async (_settlementIdx, _adjustorIdx, _documentHash, _amount_cu) => {
    // Store the hash map info for now
    const settlementHashMapInfo = await td.settlement.hashMap();
    // Get the payment advice details
    const nextBankPaymentAdvice = await td.bank.countPaymentAdviceEntries();
    // Calculate the new wc locked amount
    const wcLockedAmount_New = +(await td.pool.WC_Locked_Cu()).toNumber() - +(await td.settlement.dataStorage(td.sHash[_settlementIdx]))[1].toNumber();

    // Close the settlement
    const tx = await td.settlement.closeSettlement(td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _documentHash, _amount_cu, {from: td.accounts[_adjustorIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);
    // Verify event 0
    miscFunc.verifySettlementLog(logs, 0, td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _documentHash, null, 2);

    // Verify new settlement data
    await miscFunc.verifySettlementData(await td.settlement.dataStorage.call(td.sHash[_settlementIdx]), _settlementIdx, _amount_cu, 2);

    // Verify the new value for wc locked
    expect((await td.pool.WC_Locked_Cu()).toNumber()).to.be.equal(wcLockedAmount_New);

    // Verify if the hash map count value has decreased
    miscFunc.verifyHashMap(settlementHashMapInfo, await td.settlement.hashMap(), false);

    // Verify if a new bank payment advice has been created
    // If the payout amount is greater than 0 ensure a payment advice entry has been created
    if (_amount_cu > 0) {
        // Verify if the newly created bank payment advice entry details are correct
        const paymentAdvice = await td.bank.bankPaymentAdvice(nextBankPaymentAdvice);
        expect(5).to.be.equal(paymentAdvice.adviceType.toNumber());
        expect(setupI.SETTLEMENT_ACCOUNT_PAYMENT_HASH).to.be.equal(paymentAdvice.paymentAccountHashRecipient);
        expect(td.sHash[_settlementIdx]).to.be.equal(paymentAdvice.paymentSubject);
        expect(_amount_cu).to.be.equal(paymentAdvice.amount.toNumber());
    }
    else {
        // If payout amount is 0 ensure no new payment advice entry has been created
        expect((await td.bank.countPaymentAdviceEntries()).toNumber()).to.be.equal(nextBankPaymentAdvice);
    }
}