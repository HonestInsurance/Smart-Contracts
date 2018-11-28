/**
 * @description Various helper functions required for testing the contacts
 * @copyright (c) 2017 HIC Limited (NZBN: 9429043400973)
 * @author Martin Stellnberger
 * @license GPL-3.0
 */

const expect = require('expect.js');
const bn = require('bignumber.js');
const miscFunc = require("../misc/miscFunc.js");
const setupI = require("../misc/setupI.js");
const td = require("../misc/testData.js");

// Sleeps for the requested time period in milli seconds
exports.sleep = function(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}  

// Extracts from a byte32 value the address parameter and returns it
exports.getAdrFromBytes32 = function(bte) {
    return '0x' + bte.toString().substring(26, 66);
}

// Returns an address value as a 32byte value by inserting enought 0
exports.getBytes32FromAdr = function(adr) {
    return adr.slice(0, 2) + "000000000000000000000000" + adr.slice(2);
}

// Uses the EPOCH and creates a local readable date time string
exports.getLocalDateStringFromEpoch = function(str) {
    var d = new Date(0);
    d.setUTCSeconds(str.valueOf());

    var yy = d.getFullYear();
    var mm = d.getMonth() + 1; // getMonth() is zero-based
    var dd = d.getDate();
    var hh = d.getHours();
    var mi = d.getMinutes();
    var ss = d.getSeconds();

    var part1 = [
            yy, 
            (mm>9 ? '' : '0') + mm,
            (dd>9 ? '' : '0') + dd,
            ].join('-');

    var part2 = [
            (hh>9 ? '' : '0') + hh,
            (mi>9 ? '' : '0') + mi,
            (ss>9 ? '' : '0') + ss
            ].join(':');

    return part1 + ' ' + part2;
}

// Converts the provided hex string to ASCII string
exports.hexToAscii = function(str, len) {
    len = len ? ((len + 1) * 2) : 1000;

    var hex  = str.toString();
    var str = '';

    for (var n = 2; ((n < hex.length) && (n < len)); n += 2) {
        if (parseInt(hex.substr(n, 2), 16) > 31)
            str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
        else str += String.fromCharCode(32);
    }
    return str.trim();
}

// Shortens the provided hash to save some screen space
exports.shortenHash = function(hash) {
    return hash.substring(0, 6) + '...' + hash.substring(62, 66);
}

// Formats the provided number
exports.formatNr = function(val, isCurrency, length, allignLeft, thousandSeparator) {
    var templateStr = "                                                                            ";
    var paddingLenghString = templateStr.slice(0, length - 1);
    // If it is a currency format accordingly with $-symbol, alligned right, punctuation, and 2 digits
    if (isCurrency) {
        if (val != 0) {
            var str = (val / 100).toFixed(2).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
            return '$' + (paddingLenghString + str).slice(-paddingLenghString.length);
        }
        else {
            return paddingLenghString + '-';
        }
    }
    // If it is a number
    else {
        // Create the number with toString either with or without thousand separator
        if (thousandSeparator == true)
            var strNumber = val.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
        else var strNumber = val.toString();

        // Allign the number and add padding
        if (allignLeft == true) {
            return (strNumber + templateStr).substr(0, length);
        }
        else {
            var help = templateStr + strNumber + '   ';
            return help.substr(help.length - length, length);
        }
    }
}

// function getBondPaymentAccountHashSender(idx) { return web3.sha3('Sam Smith Bond '+ idx + '12-55555-123456-00' + idx); }
exports.getRandomHash = function() { return web3.utils.randomHex(32); }
exports.getEmptyHash = function() { return "0x0000000000000000000000000000000000000000000000000000000000000000"; }
exports.getEmptyAdr = function() { return "0x0000000000000000000000000000000000000000"; }
exports.getIdxHash = function(idx) { return web3.utils.sha3('Some random string' + idx); }

exports.getAdjustorServiceAgreement = function(idx) { return web3.utils.sha3('Sam Smith Adjustor '+ idx); }
exports.getSettlementDocument = function (idx) { return web3.utils.sha3('Settlement document '+ idx); }
exports.getPolicyDocument = function() { return 'Policy 123 Document'; };
exports.getPolicyDocumentHash = function() { return web3.utils.sha3('Policy 123 Document'); };



// Calculates the combined and updcoming bond maturity payout amounts for the next 3 days
exports.getBondMaturityPaymentsNext3Days = function() {
    var sum = 0;
    if (td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 0] != null) sum = +sum + +td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 0];
    if (td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 1] != null) sum = +sum + +td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 1];
    if (td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 2] != null) sum = +sum + +td.bondMaturityPayoutsEachDay[+td.currentPoolDay + 2];
    return sum;
}

// Calculates the averabe bond maturity payments for the future averages accross the planing horizon
exports.getBondMaturityPaymentsAveragePerDay = function() {
    var sum = 0;
    var lastDay = (setupI.DURATION_TO_BOND_MATURITY_SEC / (3600 * 24)) + +td.currentPoolDay;
    for (var i=td.currentPoolDay; i<=lastDay; i++) {
        if (td.bondMaturityPayoutsEachDay[i] != null) {
            sum = +sum + +td.bondMaturityPayoutsEachDay[i];
        }
    }
    return Math.floor(sum / (setupI.DURATION_TO_BOND_MATURITY_SEC / (3600 * 24)));
}

// Function verifies all contract addresses specified for any of the dependent contracts
exports.verifyAllContractReferenceAdr = function(idx, poolAdrRef, bondAdrRef, bankAdrRef, policyAdrRef, settlementAdrRef, adjustorAdrRef, timerAdrRef, trustAdrRef) {
    expect(poolAdrRef[idx]).to.be.equal(bondAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.equal(bankAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.equal(policyAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.equal(settlementAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.equal(adjustorAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.equal(timerAdrRef[idx]);
    expect(poolAdrRef[idx]).to.be.equal(trustAdrRef[idx]);
}

// Function compares the difference between two hash maps (first, next and count)
exports.verifyHashMap = function(_beforeHashMap, _afterHashMap, _added)
{
    // A new hash has been added to the hash map
    if (_added == true) {
        expect(_beforeHashMap[1].toNumber() + 1).to.be.equal(+_afterHashMap[1].toNumber());
        expect(_beforeHashMap[2].toNumber() + 1).to.be.equal(+_afterHashMap[2].toNumber());
    }
    // The hash map has not changed
    else if (_added == null) {
        expect(_beforeHashMap[1].toNumber()).to.be.equal(_afterHashMap[1].toNumber());
        expect(_beforeHashMap[2].toNumber()).to.be.equal(_afterHashMap[2].toNumber());
    }
    // A hash has been 'removed' (archived)
    else if (_added == false) {
        expect(_beforeHashMap[1].toNumber()).to.be.equal(_afterHashMap[1].toNumber());
        expect(_beforeHashMap[2].toNumber()).to.be.equal(_afterHashMap[2].toNumber() + 1);
    }
}

// event LogPool(bytes32 indexed subject, uint indexed day, uint indexed value, uint timestamp);
exports.verifyPoolLog = function(_logs, _idx, _subject, _day, _value, _timestamp)
{
    // Verify the provided log is a pool log with the name LogPool
    expect("LogPool").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.pool.address).to.be.equal(_logs[_idx].address);

    if (_subject != null)               expect(miscFunc.hexToAscii(_logs[_idx].events[0].value)).to.be.equal(_subject);
    if (_day != null)                   expect(Number(_logs[_idx].events[1].value)).to.be.equal(_day);
    if (_value != null)                 expect(Number(_logs[_idx].events[2].value)).to.be.equal(_value);
    if (_timestamp != null)             expect(Number(_logs[_idx].events[3].value)).to.be.equal(_timestamp);
}

// event LogTrust(bytes32 indexed subject, address indexed adr, bytes32 indexed info, uint timestamp);
exports.verifyTrustLog = function(_logs, _idx, _subject, _adr, _info, _timestamp)
{
    // Verify the provided log is a pool log with the name LogTrust
    expect("LogTrust").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.trust.address).to.be.equal(_logs[_idx].address)

    // If a parameter has been provided verify it matches _data
    if (_subject != null)               expect(miscFunc.hexToAscii(_logs[_idx].events[0].value)).to.be.equal(_subject);
    if (_adr != null)                   expect(web3.utils.toChecksumAddress(_logs[_idx].events[1].value)).to.be.equal(_adr);
    if (_info != null)                  expect(_logs[_idx].events[2].value).to.be.equal(_info);
    if (_timestamp != null)             expect(Number(_logs[_idx].events[3].value)).to.be.equal(_timestamp);
}

// event LogBank(bytes32 indexed internalReferenceHash, uint indexed accountType, bool indexed success, 
//               bytes32 paymentAccountHash, bytes32 paymentSubject, bytes32 info, uint timestamp, uint transactionType, uint amount);
exports.verifyBankLog = function(_logs, _idx, _internalReferenceHash, _accountType, _success, _paymentAccountHash,
    _paymentSubject, _info, _timestamp, _transactionType, _amount)
{
    // Verify the provided log is a pool log with the name LogBank
    expect("LogBank").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.bank.address).to.be.equal(_logs[_idx].address)

    // If a parameter has been provided verify it matches _data
    if (_internalReferenceHash != null) expect(_logs[_idx].events[0].value).to.be.equal(_internalReferenceHash);
    if (_accountType != null)           expect(Number(_logs[_idx].events[1].value)).to.be.equal(_accountType);
    if (_success != null)               expect(Boolean(_logs[_idx].events[2].value)).to.be.equal(_success);
    // if (_paymentAccountHash != null) {
    //     if (parseInt(_paymentAccountHash) > (Math.pow(10, 18)))
    //         expect(_paymentAccountHash).to.be.equal(decodedLogs[_idx].events[3].value);
    //     else expect(parseInt(_paymentAccountHash)).to.be.equal(parseInt(decodedLogs[_idx].events[3].value));
    // }
    // if (_paymentSubject != null) {
    //     if (_paymentSubject == 'Pool')
    //         expect(_paymentSubject).to.be.equal(miscFunc.hexToAscii(decodedLogs[_idx].events[4].value).trim());
    //     else expect(_paymentSubject).to.be.equal(decodedLogs[_idx].events[4].value);
    // }
    if (_info != null)                  expect(miscFunc.hexToAscii(_logs[_idx].events[5].value)).to.be.equal(_info);
    if (_timestamp != null)             expect(Number(_logs[_idx].events[6].value)).to.be.equal(_timestamp);
    if (_transactionType != null)       expect(Number(_logs[_idx].events[7].value)).to.be.equal(_transactionType);
    if (_amount != null)                expect(Number(_logs[_idx].events[8].value)).to.be.equal(_amount);
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifyBondData = function(_data, _idx, _owner, _paymentAccountHash, _principal_Cu, 
    _yield_Ppb, _maturityPayoutAmount_Cu, _creationDate,
    _nextStateExpiryDate, _maturityDate, _state, _securityReferenceHash) 
{
    // If a parameter has been provided verify it matches _data
    if (_idx != null)                           expect(_data.idx.toNumber()).to.be.equal(_idx);
    if (_owner != null)                         expect(_data.owner).to.be.equal(_owner);
    if (_paymentAccountHash != null)            expect(_data.paymentAccountHash).to.be.equal(_paymentAccountHash);
    if (_principal_Cu != null)                  expect(_data.principal_Cu.toNumber()).to.be.equal(_principal_Cu);
    if (_yield_Ppb != null)                     expect(_data.yield_Ppb.toNumber()).to.be.equal(_yield_Ppb);
    if (_maturityPayoutAmount_Cu != null)       expect(_data.maturityPayoutAmount_Cu.toNumber()).to.be.equal(_maturityPayoutAmount_Cu);
    if (_creationDate != null)                  expect(_data.creationDate.toNumber()).to.be.equal(_creationDate);
    if (_nextStateExpiryDate != null)           expect(_data.nextStateExpiryDate.toNumber()).to.be.equal(_nextStateExpiryDate);
    if (_maturityDate != null)                  expect(_data.maturityDate.toNumber()).to.be.equal(_maturityDate);
    if (_state != null)                         expect(_data.state.toNumber()).to.be.equal(_state);
    if (_securityReferenceHash != null)         expect(_data.securityReferenceHash).to.be.equal(_securityReferenceHash);
}

// event LogBond(bytes32 indexed bondHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
exports.verifyBondLog = function(_logs, _idx, _bondHash, _owner, _info, _timestamp, _state)
{
    // Verify the provided log is a bond log with the name LogBond
    expect("LogBond").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.bond.address).to.be.equal(_logs[_idx].address)

    // If a parameter has been provided verify it matches _data
    if (_bondHash != null)          expect(_logs[_idx].events[0].value).to.be.equal(_bondHash);
    if (_owner != null)             expect(web3.utils.toChecksumAddress(_logs[_idx].events[1].value)).to.be.equal(_owner);
    //if (_info != null)              expect(_logs[_idx].events[2].value).to.be.eql(_info);
    if (_timestamp != null)         expect(Number(_logs[_idx].events[3].value)).to.be.equal(_timestamp);
    if (_state != null)             expect(Number(_logs[_idx].events[4].value)).to.be.equal(_state);
    // Return the bondHash stored in the event log
    return _logs[_idx].events[0].value;
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifyPolicyData = function(_data, _idx, _owner, _paymentAccountHash, _documentHash, 
    _riskPoints, _premiumCredited_Cu, _premiumCharged_Cu_Ppt, _state, _lastReconciliationDay, _nextReconciliationDay) 
{
    if (_idx != null)                           expect(_data.idx.toNumber()).to.be.equal(_idx);
    if (_owner != null)                         expect(_data.owner).to.be.equal(_owner);
    if (_paymentAccountHash != null)            expect(_data.paymentAccountHash).to.be.equal(_paymentAccountHash);
    if (_documentHash != null)                  expect(_data.documentHash).to.be.equal(_documentHash);
    if (_riskPoints != null)                    expect(_data.riskPoints.toNumber()).to.be.equal(_riskPoints);
    if (_premiumCredited_Cu != null)            expect(_data.premiumCredited_Cu.toNumber()).to.be.equal(_premiumCredited_Cu);
    if (_premiumCharged_Cu_Ppt != null)         expect(_data.premiumCharged_Cu_Ppt.toNumber()).to.be.equal(_premiumCharged_Cu_Ppt);
    if (_state != null)                         expect(_data.state.toNumber()).to.be.equal(_state);
    if (_lastReconciliationDay != null)         expect(_data.lastReconciliationDay.toNumber()).to.be.equal(_lastReconciliationDay);
    if (_nextReconciliationDay != null)         expect(_data.nextReconciliationDay.toNumber()).to.be.equal(_nextReconciliationDay);
}

// event LogPolicy(bytes32 indexed policyHash, address indexed owner, bytes32 indexed info, uint timestamp, uint state);
exports.verifyPolicyLog = function(_logs, _idx, _policyHash, _owner, _info, _timestamp, _state)
{
    // Verify the provided log is a policy log with the name LogPolicy
    expect("LogPolicy").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.policy.address).to.be.equal(_logs[_idx].address)

    // If a parameter has been provided verify it matches _data
    if (_policyHash != null)        expect(_logs[_idx].events[0].value).to.be.equal(_policyHash);
    if (_owner != null)             expect(web3.utils.toChecksumAddress(_logs[_idx].events[1].value)).to.be.equal(_owner);
    if (_info != null)              expect(_logs[_idx].events[2].value).to.be.eql(_info);
    if (_timestamp != null)         expect(Number(_logs[_idx].events[3].value)).to.be.equal(_timestamp);
    if (_state != null)             expect(Number(_logs[_idx].events[4].value)).to.be.equal(_state);
    // Return the policyHash stored in the event log
    return _logs[_idx].events[0].value;
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifyAdjustorData = function(_data, _idx, _owner, _settlementApprovalAmount_Cu, _policyRiskPointLimit, _serviceAgreement) 
{
    if (_idx != null)                           expect(_data.idx.toNumber()).to.be.equal(_idx);
    if (_owner != null)                         expect(_data.owner).to.be.equal(_owner);
    if (_settlementApprovalAmount_Cu != null)   expect(_data.settlementApprovalAmount_Cu.toNumber()).to.be.equal(_settlementApprovalAmount_Cu);
    if (_policyRiskPointLimit != null)          expect(_data.policyRiskPointLimit.toNumber()).to.be.equal(_policyRiskPointLimit);
    if (_serviceAgreement != null)              expect(_data.serviceAgreementHash).to.be.equal(_serviceAgreement);
}

// event LogAdjustor(bytes32 indexed adjustorHash, address indexed owner, bytes32 indexed info, uint timestamp);
exports.verifyAdjustorLog = function(_logs, _idx, _adjustorHash, _owner, _info, _timestamp)
{
    // Verify the provided log is an adjustor log with the name LogAdjustor
    expect("LogAdjustor").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.adjustor.address).to.be.equal(_logs[_idx].address)

    // If a parameter has been provided verify it matches _data
    if (_adjustorHash != null)      expect(_logs[_idx].events[0].value).to.be.equal(_adjustorHash);
    if (_owner != null)             expect(web3.utils.toChecksumAddress(_logs[_idx].events[1].value)).to.be.equal(_owner);
    if (_info != null)              expect(_logs[_idx].events[2].value).to.be.eql(_info);
    if (_timestamp != null)         expect(Number(_logs[_idx].events[3].value)).to.be.equal(_timestamp);
    // Return the adjustor hash stored in the event log
    return _logs[_idx].events[0].value;
}

// Function verifies if the data in _data matches the other parameter if they are provided
exports.verifySettlementData = function(_data, _idx, _settlementAmount, _state) 
{
    if (_idx != null)                   expect(_data.idx.toNumber()).to.be.equal(_idx);
    if (_settlementAmount != null)      expect(_data.settlementAmount.toNumber()).to.be.equal(_settlementAmount);
    if (_state != null)                 expect(_data.state.toNumber()).to.be.equal(_state);
}

// event LogSettlement(bytes32 indexed settlementHash, bytes32 indexed adjustorHash, bytes32 indexed info, uint timestamp, uint state);
exports.verifySettlementLog = function(_logs, _idx, _settlementHash, _adjustorHash, _info, _timestamp, _state)
{
    // Verify the provided log is a settlement log with the name LogSettlement
    expect("LogSettlement").to.be.equal(_logs[_idx].name);
    // Verify the event was created by the correct contract
    expect(td.settlement.address).to.be.equal(_logs[_idx].address)

    // If a parameter has been provided verify it matches _data
    if (_settlementHash != null)        expect(_logs[_idx].events[0].value).to.be.equal(_settlementHash);
    if (_adjustorHash != null)          expect(_logs[_idx].events[1].value).to.be.equal(_adjustorHash);
    if (_info != null)                  expect(_logs[_idx].events[2].value).to.be.equal(_info);
    if (_timestamp != null)             expect(Number(_logs[_idx].events[3].value)).to.be.equal(_timestamp);
    if (_state != null)                 expect(Number(_logs[_idx].events[4].value)).to.be.equal(_state);
    // Return the settlementHash stored in the event log
    return _logs[_idx].events[0].value;
}
