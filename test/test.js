'use strict';

const { expect } = require('chai');

const {
  network: {
    provider: testProvider
  }
} = require('hardhat');
const constants = require('@ethersproject/constants');

const { JsonRpcProvider } = require('@ethersproject/providers');
const { makeEthersBase } = require('../');

const WETH = makeEthersBase(require('canonical-weth/build/contracts/WETH9'));

const provider = new (class extends JsonRpcProvider {})();
Object.getPrototypeOf(provider).send = testProvider.send.bind(testProvider);

describe('eth-manager v3', () => {
  it('should let you override contract functions and call super', async () => {
    const factory = WETH.getFactory(provider.getSigner(0));
    const signerAddress = await provider.getSigner(0).getAddress();
    class DerivedWETH extends WETH {
      async balanceOf() {
        const superResult = await super.balanceOf(signerAddress);
        return superResult.add(1);
      }
    }
    const { address } = await factory.deploy();
    const weth = new DerivedWETH(address, provider.getSigner(0));
    const result = await weth.balanceOf();
    expect(Number(result)).to.eql(1);
  });
  it('static get(network, provider)', async () => {
    class DerivedWETH extends WETH {
      static get networks() {
        return {
          '4': {
            address: constants.AddressZero
          }
        }
      }
      async balanceOf() {
        try {
          const superResult = await super.balanceOf(signerAddress);
          return superResult.add(1);
        } catch (e) {
          return 'err';
        }
      }
    }
    const derived = DerivedWETH.get('rinkeby');
    expect(derived.address).to.eql(constants.AddressZero);
    expect(await derived.balanceOf()).to.eql('err');
  })
});
