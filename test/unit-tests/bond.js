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
// ----------------

// createBond(uint _principal_Cu, bytes32 _hashOfReferenceBond)
exports.createBond = async (_bondPrincipal, _hashOfReferenceBond, _bondOwnerAccountIdx) => {
    // Retrieve the hash map info from the bond firstIdx, nextIdx, count
    const bondHashMapInfo = await td.bond.hashMap();
    // Create a new Bond
    const tx = await td.bond.createBond(_bondPrincipal, _hashOfReferenceBond, {from: td.accounts[_bondOwnerAccountIdx]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // Get the bond hash
    const bondHash = miscFunc.verifyBondLog(logs, 0);
    // Save the bond hash
    td.bHash[bondHashMapInfo.nextIdx.toNumber()] = bondHash;

    // Event 0 - Bond creation
    miscFunc.verifyBondLog(logs, 0, bondHash, td.accounts[_bondOwnerAccountIdx], _bondPrincipal, null, 0);
        
    // If bond has been only created
    if (_hashOfReferenceBond == miscFunc.getEmptyHash()) {
        // Call the function to verify all bond data of the newly created bond
        await miscFunc.verifyBondData(await td.bond.dataStorage(bondHash), bondHashMapInfo.nextIdx.toNumber(), td.accounts[_bondOwnerAccountIdx], 
            null, _bondPrincipal, 0, null, null, null, null, 0, miscFunc.getEmptyHash());
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
        miscFunc.verifyBondLog(logs, 1, _hashOfReferenceBond, td.accounts[_bondOwnerAccountIdx], bondHash, null, 5);
        // Event 2 - Bond that is secured
        miscFunc.verifyBondLog(logs, 2, bondHash, td.accounts[_bondOwnerAccountIdx], _hashOfReferenceBond, null, 2); 
        // Event 3 - Bond signing
        miscFunc.verifyBondLog(logs, 3, bondHash, td.accounts[_bondOwnerAccountIdx], finalBondYield, null, 3);
        
        // Call the function to verify all bond data of the newly created bond
        await miscFunc.verifyBondData(await td.bond.dataStorage(bondHash), bondHashMapInfo.nextIdx.toNumber(), td.accounts[_bondOwnerAccountIdx], 
            null, _bondPrincipal, finalBondYield, null, null, null, null, 3, _hashOfReferenceBond);

        // Call the function to verify all bond data of the bond that provided the underwriting
        await miscFunc.verifyBondData(await td.bond.dataStorage(_hashOfReferenceBond), null, td.accounts[_bondOwnerAccountIdx], 
            null, null, null, null, null, null, null, 5, bondHash);
    }
    
    // Verify the bond has been added to the hash map
    miscFunc.verifyHashMap(bondHashMapInfo, await td.bond.hashMap(), true);
    
    // Verify the new pool yield
    expect((await td.pool.B_Yield_Ppb()).toNumber()).to.be.equal(td.b_yield_ppb);
    // Verify new value for wc bond
    expect((await td.pool.WC_Bond_Cu()).toNumber()).to.be.equal(td.wc_bond_cu);
    // Verify new value for wc transit
    expect((await td.pool.WC_Transit_Cu()).toNumber()).to.be.equal(td.wc_transit_cu);
}

// processMaturedBond(bytes32 _bondHash, uint _scheduledDateTime)
exports.processMaturedBond = async (_bondHash) => {
    // Store the hash map info for now
    const bondHashMapInfo = await td.bond.hashMap();
    // Get the payment advice details
    const nextBankPaymentAdvice = (await td.bank.countPaymentAdviceEntries()).toNumber();
    // Retrieve the initial bond data
    const initialBondData = await td.bond.dataStorage(_bondHash);
    
    let bondPayoutAmount = initialBondData.maturityPayoutAmount_Cu.toNumber();
    let bondInitialState = initialBondData.state.toNumber();;
    let bondFinalState = 7;         // Matured

    // If bond is not in an active state set the final state to defaulted
    if (bondInitialState != 4) 
        bondFinalState = 6;         // Defaulted

    // If bond is in signed state reduce wc_transit_cu by the expeced amount
    if (bondInitialState == 3) {
        //Transit -= Bond Principal - Bond Deposited amount;
        td.wc_transit_cu -= +initialBondData.principal_Cu.toNumber();
    }

    // Get the details of the bond that was underwritten with this bond
    if (bondInitialState == 5) {
        const securityReferenceBond = await td.bond.dataStorage(initialBondData.securityReferenceHash);
        // Reduce the bond payout amount accordingly
        bondPayoutAmount -= ((+securityReferenceBond.principal_Cu.toNumber() * +setupI.BOND_REQUIRED_SECURITY_REFERENCE_PPT) / Math.pow(10, 3));
    }

    // Adjust wc_bal_ba_cu
    td.wc_bal_ba_cu -= +bondPayoutAmount;
        
    // Process the matured bond
    const tx = await td.timer.manualPing(td.bond.address, 0, _bondHash, td.futureEpochTimeStamp, {from: td.accounts[0]});
    // Extract the decoded logs
    const logs = td.abiDecoder.decodeLogs(tx.receipt.rawLogs);

    // Check the bond event details
    miscFunc.verifyBondLog(logs, 0, _bondHash, initialBondData.owner, bondPayoutAmount, null, bondFinalState);
    
    // If the payout amount is greater than 0 ensure a payment advice entry has been created
    if (bondPayoutAmount > 0) {
        // Verify if the newly created bank payment advice entry details are correct
        const paymentAdvice = await td.bank.bankPaymentAdvice(nextBankPaymentAdvice);
        // Verify the details of the newly created bank payment advice entry
        expect(2).to.be.equal(paymentAdvice.adviceType.toNumber());
        expect(web3.utils.sha3(_bondHash)).to.be.equal(paymentAdvice.paymentAccountHashRecipient);
        expect(_bondHash).to.be.equal(paymentAdvice.paymentSubject);
        expect(bondPayoutAmount).to.be.equal(paymentAdvice.amount.toNumber());
    }
    else {
        // If payout amount is 0 ensure no new payment advice entry has been created
        expect(nextBankPaymentAdvice).to.be.equal((await td.bank.countPaymentAdviceEntries()).toNumber()); 
    }

    // Verify the bond data
    await miscFunc.verifyBondData(await td.bond.dataStorage(_bondHash), null, null, null, null, null, bondPayoutAmount, null, null, null, bondFinalState, null);

    // Verify the bond has been removed from the hash map
    miscFunc.verifyHashMap(bondHashMapInfo, await td.bond.hashMap(), false);

    // Verify new value for wc bond
    expect((await td.pool.WC_Bal_BA_Cu()).toNumber()).to.be.equal(td.wc_bal_ba_cu);
    // Verify new value for wc transit
    expect((await td.pool.WC_Transit_Cu()).toNumber()).to.be.equal(td.wc_transit_cu);
}