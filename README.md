# ethers-base

Generate a class from a Truffle-compatible build artifact, which can be constructed with an (address, providerOrSigner) pair, or you can use the convenience methods for construction.

You can also extend them!

## Example

```js
const WETHArtifact = require('canonical-weth/build/contracts/WETH9');
const ethers = require('ethers');
const { makeEthersBase } = require('ethers-base');

const WETH = makeEthersBase(WETHArtifact);
(async () => {
  let weth = WETH.get('mainnet');
  console.log(await weth.balanceOf(ethers.constants.AddressZero)); // hopefully this isn't too big
  const signer = new ethers.Wallet(pvtKey).connect(weth.provider);
  weth = await WETH.lookup(signer);
  const tx = await weth.transfer(ethers.constants.AddressZero, ethers.utils.parseEther('1')) // who cares anymore
}).catch((err) => console.error(err));
```

Or you can extend it`

```js

class WETH extends makeEthersBase(WETHArtifact) {
  async transfer(target, amount) {
    return await super.transfer(ethers.constants.AddressZero, amount); // troll
  }
}

```

## Author

Raymond Pulver IV

## License

MIT
