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
    
    // Get the settlement hash
    const settlementHash = miscFunc.eventLog('Settlement', tx, 0, 0);
    // Save the settlement hash
    td.sHash[settlementHashMapInfo[1].valueOf()] = settlementHash;
    
    // Event(s) is/are triggered as part of the settlement creation log[0]: Settlement event
    // event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
    // idx                                 0                               1                             2          3               4
    // Event 0 - Settlement creation
    expect(td.aHash[_adjustorIdx]).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 1));
    expect(_policyHash).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 2));
    expect(0).to.be.eql(parseInt(miscFunc.eventLog('Settlement', tx, 0, 4)));
    
    if (_documentHash != miscFunc.getEmptyHash()) {
        // Event 1 - Settlement document added event
        expect(td.aHash[_adjustorIdx]).to.be.eql(miscFunc.eventLog('Settlement', tx, 1, 1));
        expect(_documentHash).to.be.eql(miscFunc.eventLog('Settlement', tx, 1, 2));
        expect(1).to.be.eql(parseInt(miscFunc.eventLog('Settlement', tx, 1, 4)));
    }
      
    // Call the function to verify all settlement data
    await miscFunc.verifySettlementData(await td.settlement.dataStorage.call(settlementHash), settlementHashMapInfo[1].valueOf(), 0, (_documentHash == miscFunc.getEmptyHash() ? 0 : 1));
    
    // Verify the settlement has been added to the hash map
    miscFunc.verifyHashMap(settlementHashMapInfo, await td.settlement.hashMap(), true);
}

// addSettlementInfo(bytes32 _settlementHash, bytes32 _adjustorHash, bytes32 _documentHash) 
exports.addSettlementInfo = async (_settlementIdx, _adjustorIdx, _documentHash) => {
    // Add document hash to the specified settlement
    const tx = await td.settlement.addSettlementInfo(td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _documentHash, {from: td.accounts[_adjustorIdx]});
    
    // Event is triggered as part of the settlement update log[0]: Settlement event
    // event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
    // idx                                 0                               1                             2          3               4
    // Event 0 - Settlement document added event
    expect(td.sHash[_settlementIdx]).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 0));
    expect(td.aHash[_adjustorIdx]).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 1));
    expect(_documentHash).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 2));
    expect(1).to.be.eql(parseInt(miscFunc.eventLog('Settlement', tx, 0, 4)));
}

// setExpectedSettlementAmount(bytes32 _settlementHash, bytes32 _adjustorHash, uint _expectedSettlementAmount) 
exports.setExpectedSettlementAmount = async (_settlementIdx, _adjustorIdx, _amount_cu) => {
    // Get the settlement details
    const settlementData = await td.settlement.dataStorage(td.sHash[_settlementIdx]);
    const wc_locked_before = await td.pool.WC_Locked_Cu();

    // Set the expected settlement amount for the settlement
    await td.settlement.setExpectedSettlementAmount(td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _amount_cu, {from: td.accounts[_adjustorIdx]});
    // Verify new settlement data
    await miscFunc.verifySettlementData(await td.settlement.dataStorage.call(td.sHash[_settlementIdx]), _settlementIdx, _amount_cu, null);

    // Verify the new value for wc locked
    const wcLockedAmount_New = +wc_locked_before.valueOf() + (+_amount_cu - +settlementData[1].valueOf());
    expect((await td.pool.WC_Locked_Cu()).valueOf()).to.be.eql(wcLockedAmount_New.valueOf());
}

// closeSettlement(bytes32 _settlementHash, bytes32 _adjustorHash, bytes32 _documentHash, uint _settlementAmount) 
exports.closeSettlement = async (_settlementIdx, _adjustorIdx, _documentHash, _amount_cu) => {
    // Store the hash map info for now
    const settlementHashMapInfo = await td.settlement.hashMap();
    // Get the payment advice details
    const nextBankPaymentAdvice = await td.bank.countPaymentAdviceEntries();
    // Calculate the new wc locked amount
    const wcLockedAmount_New = +(await td.pool.WC_Locked_Cu()).valueOf() - +(await td.settlement.dataStorage(td.sHash[_settlementIdx]))[1].valueOf();

    // Close the settlement
    const tx = await td.settlement.closeSettlement(td.sHash[_settlementIdx], td.aHash[_adjustorIdx], _documentHash, _amount_cu, {from: td.accounts[_adjustorIdx]});

    // Event is triggered as part of the settlement closure log[0]: Settlement event
    // event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
    // idx                                 0                               1                             2          3               4
    // Event 0 - Settlement closed
    expect(td.sHash[_settlementIdx]).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 0));
    expect(td.aHash[_adjustorIdx]).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 1));
    expect(_documentHash).to.be.eql(miscFunc.eventLog('Settlement', tx, 0, 2));
    expect(2).to.be.eql(parseInt(miscFunc.eventLog('Settlement', tx, 0, 4)));

    // Verify new settlement data
    await miscFunc.verifySettlementData(await td.settlement.dataStorage.call(td.sHash[_settlementIdx]), _settlementIdx, _amount_cu, 2);

    // Verify the new value for wc locked
    expect((await td.pool.WC_Locked_Cu()).valueOf()).to.be.eql(wcLockedAmount_New.valueOf());

    // Verify if the hash map count value has decreased
    miscFunc.verifyHashMap(settlementHashMapInfo, await td.settlement.hashMap(), false);

    // Verify if a new bank payment advice has been created
    // If the payout amount is greater than 0 ensure a payment advice entry has been created
    if (_amount_cu > 0) {
        // Verify if the newly created bank payment advice entry details are correct
        const paymentAdv = await td.bank.bankPaymentAdvice(nextBankPaymentAdvice);
        expect(5).to.be.eql(paymentAdv[0].valueOf());
        expect(setupI.SETTLEMENT_ACCOUNT_PAYMENT_HASH).to.be.eql(paymentAdv[1].valueOf());
        expect(td.sHash[_settlementIdx]).to.be.eql(paymentAdv[2].valueOf());
        expect(_amount_cu).to.be.eql(paymentAdv[3].valueOf());
    }
    else {
        // If payout amount is 0 ensure no new payment advice entry has been created
        expect((await td.bank.countPaymentAdviceEntries()).valueOf()).to.be.eql(nextBankPaymentAdvice);
    }
}