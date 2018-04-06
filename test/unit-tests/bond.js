/**
 * @description Unit tests for verifying Bond contract functions
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const bn = require('bignumber.js');
const miscFunc = require("../misc/miscFunc.js");
const setupI = require("../misc/setupI.js");
const td = require("../misc/testData.js");

// --- Solidity Contract Info ---
// contract Bond is SetupI, IntAccessI, NotificationI, HashMapI
// event LogBond(bytes32 indexed bondHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
// idx                           0                         1                      2          3               4
// ----------------

// createBond(uint _principal_Cu, bytes32 _hashOfReferenceBond)
exports.createBond = async (_bondPrincipal, _hashOfReferenceBond, _bondOwnerAccountIdx) => {
    // Retrieve the hash map info from the bond firstIdx, nextIdx, count
    const bondHashMapInfo = await td.bond.hashMap();
    // Create a new Bond
    const tx = await td.bond.createBond(_bondPrincipal, _hashOfReferenceBond, {from: td.accounts[_bondOwnerAccountIdx]});
    // Get the bond hash
    const bondHash = miscFunc.eventLog('Bond', tx, 0, 0);
    // Save the bond hash
    td.bHash[bondHashMapInfo[1].valueOf()] = bondHash;

    // Event 0 - Bond creation
    expect(td.accounts[_bondOwnerAccountIdx]).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Bond', tx, 0, 1)));
    expect(_bondPrincipal).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 0, 2)));
    expect(0).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 0, 4)));
        
    // If bond has been only created
    if (_hashOfReferenceBond == 0x0) {
        // Call the function to verify all bond data of the newly created bond
        await miscFunc.verifyBondData(await td.bond.dataStorage(bondHash), bondHashMapInfo[1].valueOf(), td.accounts[_bondOwnerAccountIdx], 
            null, _bondPrincipal, 0, null, null, null, null, 0, 0x0);
    } 
    //  Bond has also been secured by another bond and signed check the log files
    else {
        // Calculate the final bond yield and update pool variables
        // Calcuate the expected yield average
        const yieldAvg = Math.floor((td.b_gradient_ppq * _bondPrincipal) / (2 * (Math.pow(10, 6))));
        // Calculate the final and expected bond yield
        const finalBondYield = Math.max(setupI.MIN_YIELD_PPB, +td.b_yield_ppb - +yieldAvg);
        // Calculate the final and expected pool yield
        td.b_yield_ppb = Math.max(setupI.MIN_YIELD_PPB, +td.b_yield_ppb - (2 * +yieldAvg));

        // Adjust wc_bond_cu
        td.wc_bond_cu = +td.wc_bond_cu - +_bondPrincipal;
        // Adjust wc_transit_cu
        td.wc_transit_cu = +td.wc_transit_cu + +_bondPrincipal;

        // Event 1 - Bond that is performing the securing service
        expect(_hashOfReferenceBond).to.be.eql(miscFunc.eventLog('Bond', tx, 1, 0));
        expect(td.accounts[_bondOwnerAccountIdx]).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Bond', tx, 1, 1)));
        expect(bondHash).to.be.eql(miscFunc.eventLog('Bond', tx, 1, 2));
        expect(5).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 1, 4)));

        // Event 2 - Bond that is secured
        expect(bondHash).to.be.eql(miscFunc.eventLog('Bond', tx, 2, 0));
        expect(_hashOfReferenceBond).to.be.eql(miscFunc.eventLog('Bond', tx, 2, 2));
        expect(2).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 2, 4)));

        // Event 3 - Bond signing
        expect(bondHash).to.be.eql(miscFunc.eventLog('Bond', tx, 3, 0));
        expect(finalBondYield).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 3, 2)));
        expect(3).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 3, 4)));

        // Call the function to verify all bond data of the newly created bond
        await miscFunc.verifyBondData(await td.bond.dataStorage(bondHash), bondHashMapInfo[1].valueOf(), td.accounts[_bondOwnerAccountIdx], 
            null, _bondPrincipal, finalBondYield, null, null, null, null, 3, _hashOfReferenceBond);

        // Call the function to verify all bond data of the bond that provided the underwriting
        await miscFunc.verifyBondData(await td.bond.dataStorage(_hashOfReferenceBond), null, td.accounts[_bondOwnerAccountIdx], 
            null, null, null, null, null, null, null, 5, bondHash);
    }
    
    // Verify the bond has been added to the hash map
    miscFunc.verifyHashMap(bondHashMapInfo, await td.bond.hashMap(), true);
    
    // Verify the new pool yield
    expect((await td.pool.B_Yield_Ppb()).valueOf()).to.be.eql(td.b_yield_ppb);
    // Verify new value for wc bond
    expect((await td.pool.WC_Bond_Cu()).valueOf()).to.be.eql(td.wc_bond_cu);
    // Verify new value for wc transit
    expect((await td.pool.WC_Transit_Cu()).valueOf()).to.be.eql(td.wc_transit_cu);
}

// processMaturedBond(bytes32 _bondHash, uint _scheduledDateTime)
exports.processMaturedBond = async (_bondHash) => {
    // Store the hash map info for now
    const bondHashMapInfo = await td.bond.hashMap();
    // Get the payment advice details
    const nextBankPaymentAdvice = (await td.bank.countPaymentAdviceEntries()).valueOf();
    // Retrieve the initial bond data
    const initialBondData = await td.bond.dataStorage(_bondHash);
    
    let bondPayoutAmount = initialBondData[5].valueOf();
    let bondInitialState = initialBondData[9].valueOf();;
    let bondFinalState = 7;         // Matured

    // If bond is not in an active state set the final state to defaulted
    if (bondInitialState != 4) 
        bondFinalState = 6;         // Defaulted

    // If bond is in signed state reduce wc_transit_cu by the expeced amount
    if (bondInitialState == 3) {
        //Transit -= Bond Principal - Bond Deposited amount;
        td.wc_transit_cu -= +initialBondData[3].valueOf();
    }

    // Get the details of the bond that was underwritten with this bond
    if (bondInitialState == 5) {
        const securityReferenceBond = await td.bond.dataStorage(initialBondData[10]);
        // Reduce the bond payout amount accordingly
        bondPayoutAmount -= ((+securityReferenceBond[3].valueOf() * +setupI.BOND_REQUIRED_SECURITY_REFERENCE_PPT) / Math.pow(10, 3));
    }

    // Adjust wc_bal_ba_cu
    td.wc_bal_ba_cu -= +bondPayoutAmount;
        
    // Process the matured bond
    const tx = await td.timer.manualPing(td.bond.address, 0, _bondHash, td.futureEpochTimeStamp, {from: td.accounts[0]});

    // Check the bond event details
    expect(_bondHash).to.be.eql(miscFunc.eventLog('Bond', tx, 0, 0));
    expect(initialBondData[1].valueOf()).to.be.eql(miscFunc.getAdrFromBytes32(miscFunc.eventLog('Bond', tx, 0, 1)));
    expect(bondPayoutAmount).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 0, 2)));
    expect(bondFinalState).to.be.eql(parseInt(miscFunc.eventLog('Bond', tx, 0, 4)));
    
    // If the payout amount is greater than 0 ensure a payment advice entry has been created
    if (bondPayoutAmount > 0) {
        // Verify if the newly created bank payment advice entry details are correct
        const paymentAdvice = await td.bank.bankPaymentAdvice(nextBankPaymentAdvice);
        // Verify the details of the newly created bank payment advice entry
        expect(2).to.be.eql(paymentAdvice[0].valueOf());
        expect(web3.sha3(_bondHash)).to.be.eql(paymentAdvice[1].valueOf());
        expect(_bondHash).to.be.eql(paymentAdvice[2].valueOf());
        expect(bondPayoutAmount).to.be.eql(paymentAdvice[3].valueOf());
    }
    else {
        // If payout amount is 0 ensure no new payment advice entry has been created
        expect(nextBankPaymentAdvice).to.be.eql((await td.bank.countPaymentAdviceEntries()).valueOf()); 
    }

    // Verify the bond data
    await miscFunc.verifyBondData(await td.bond.dataStorage(_bondHash), null, null, null, null, null, bondPayoutAmount, null, null, null, bondFinalState, null);

    // Verify the bond has been removed from the hash map
    miscFunc.verifyHashMap(bondHashMapInfo, await td.bond.hashMap(), false);

    // Verify new value for wc bond
    expect((await td.pool.WC_Bal_BA_Cu()).valueOf()).to.be.eql(td.wc_bal_ba_cu);
    // Verify new value for wc transit
    expect((await td.pool.WC_Transit_Cu()).valueOf()).to.be.eql(td.wc_transit_cu);
}