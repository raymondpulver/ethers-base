'use strict';

const { Contract, ContractFactory } = require('@ethersproject/contracts');
const { Logger } = require('@ethersproject/logger');
const constants = require('@ethersproject/constants');
const { InfuraProvider, BaseProvider } = require('@ethersproject/providers');
const { Interface } = require('@ethersproject/abi');
const { getStatic } = require('@ethersproject/properties');
const _version = {
  version: 'simple-ethers-base/0.1.0'
};

exports.TEST_CHAIN_ID = '31337';

const logger = new Logger(_version);

const getInfura = (network) => new InfuraProvider(network, process.env.INFURA_PROJECT_ID);

const defineReadOnlyAndConfigurable = (o, prop, value) => {
  // ethers.js really doesn't want their immutables to be made mutable, here's the function we want them to use
  Object.defineProperty(o, prop, {
    value,
    writable: false,
    enumerable: true,
    configurable: true
  });
};

exports.collapseSimple = (outputs) => Array.isArray(outputs) && outputs.length === 1 ? outputs[0] : outputs;

exports.tryToGetInfura = (network) => {
  switch (network) {
    case "1":
      return getInfura("mainnet");
    case "42":
      return getInfura("kovan");
    case "4":
      return getInfura("rinkeby");
    default:
      return new JsonRpcProvider("http://localhost:8545");
  }
};

const redefineReadWriteable = (o, prop) => {
  Object.defineProperty(o, prop, {
    writable: true,
    configurable: true,
    enumerable: true,
    value: this[prop]
  });
};

exports.toChainId = (network) => {
  if (isNaN(network)) {
    switch (network) {
      case "mainnet":
        return "1";
      case "morden":
        return "2";
      case "ropsten":
        return "3";
      case "rinkeby":
        return "4";
      case "goerli":
        return "5";
      case "kovan":
        return "42";
      default:
        return exports.TEST_CHAIN_ID;
    }
  }
  return network;
};

exports.coerceToSigner = (providerOrSigner) => {
  try {
    return providerOrSigner.getSigner();
  } catch (e) {
    return providerOrSigner;
  }
};

exports.coerceToProvider = (providerOrSigner) => {
  return providerOrSigner.provider || providerOrSigner;
};

const dirtyExtend = (derived, base) => {
  Object.setPrototypeOf(derived.prototype, base.prototype);
  Object.setPrototypeOf(derived, base);
  return derived; // sorry, ES6
};

const makeMutableAndSet = (o, prop, value) => {
  Object.defineProperty(o, prop, {
    enumerable: true,
    writable: true,
    configurable: true,
    value
  });
};

const generateDefaultFunction = (name) => async function (...args) {
  return exports.collapseSimple(await this.functions[name](...args));
};

const generateAndAssignDefaultFunction = (Klass, name) => {
  Object.defineProperty(Klass.prototype, name, {
    value: generateDefaultFunction(name),
    enumerable: false,
    configurable: true,
    writable: true
});
};

exports.EthersSuper = dirtyExtend(class EthersSuper { // we don't explicitly extend Contract because we need to make JavaScript think we don't need to call super before getting "this", so we Object.setPrototypeOf below
  unfreezeProperty(prop) {
    redefineReadWriteable(this, prop);
  }
  /* make some functions so we can just get these static properties */
  get interface() {
    return getStatic(this.constructor, 'interface');
  }
  set interface(v) {
    makeMutableAndSet(this.constructor, 'interface', v);
  }
  get abi() {
    return getStatic(this.constructor, 'abi');
  }
  set abi(v) {
    makeMutableAndSet(this.constructor, 'abi', v);
  }
  get bytecode() {
    return getStatic(this.constructor, 'bytecode');
  }
  set bytecode(v) {
    makeMutableAndSet(this.constructor, 'bytecode', v);
  }
  get functions() {
    return getStatic(this.constructor, 'functions');
  }
  set functions(v) {
    makeMutableAndSet(this.constructor, 'functions', v);
  }
  static getFactory(providerOrSigner) {
    const constructor = this;
    class EthersBaseFactory extends ContractFactory {
      constructor(providerOrSigner) {
        super(constructor.abi, constructor.bytecode, exports.coerceToSigner(providerOrSigner));
      }
      async deploy(...args) {
        const contract = await super.deploy(...args);
        return new constructor(contract.address, contract.signer || contract.provider);
      }
    }
    return new EthersBaseFactory(providerOrSigner);
  }
  constructor(address, providerOrSigner, extraArg) {
    if (!providerOrSigner.send && !providerOrSigner.sendTransaction && typeof extraArg === 'object') {
      providerOrSigner = extraArg; // if we're calling EthersSuper#connect or EthersSuper#attach we would like to correct what ethers.js will try to supply to the constructor
    }
    const prototype = Object.getPrototypeOf(this);
    const interceptorTarget = new Proxy(this, {
      set: (o, prop, value, receiver) => {
          console.log(prop);
        if (typeof value !== 'function') 
          this[prop] = value;
        return this;
      },
      defineProperty: (o, prop, descriptor) => {
        descriptor.configurable = true;
        if (typeof descriptor.value !== 'function') {
          Object.defineProperty(this, prop, descriptor);
        }
        return o;
      }
    });
    Contract.call(interceptorTarget, address, this.abi, providerOrSigner); // we swipe all the computed functions so we can make something with it, we don't want them to go to this
    Object.setPrototypeOf(this, prototype);
  }
  static setLocal(address) {
    this.networks = this.networks || {};
    this.networks[exports.TEST_CHAIN_ID] = { address };
  }
  getContract(address, interfaceObject, signerOrProvider) {
    return new this.constructor(address, signerOrProvider);
  }
  static async lookup(providerOrSigner) { // make it so we can just get the contract instance from the provider
    const { chainId } = await exports.coerceToProvider(providerOrSigner).getNetwork();
    return this.get(chainId, providerOrSigner);
  }
  static get(network, providerOrSigner) {
    const chainId = exports.toChainId(network);
    const networkRecord = this.networks[chainId];
    if (!networkRecord) logger.throwError("no network exists for " + network + " (" + chainId + ")", Logger.errors.INVALID_ARGUMENT);
    return new this(networkRecord.address, providerOrSigner || exports.tryToGetInfura(chainId));
  }
}, Contract);

exports.makeEthersBase = (artifact) => {
  const ethersBase = class EthersBase extends exports.EthersSuper {}
  const interceptorTarget = new Proxy(Object.create(Contract.prototype), {
    defineProperty: (receiver, prop, descriptor) => {
      descriptor.configurable = true;
      if (typeof descriptor.value === 'function') {
        generateAndAssignDefaultFunction(ethersBase, prop);
      } else {
        Object.defineProperty(receiver, prop, descriptor);
      }
      return receiver;
    },
    get: (o, prop) => {
      return ethersBase.prototype[prop] || o[prop];
    },
    set: (o, prop, value) => {
      if (typeof value === 'function') {
        generateAndAssignDefaultFunction(ethersBase, prop);
      } else {
        o[prop] = value;
      }
    }
  });
  
  if (!artifact.abi) logger.warn('EthersBase constructed but artifact has no abi');
  const abi = artifact.abi || [];
  const contractInterface = new Interface(artifact.abi);
  Object.assign(ethersBase, {
    abi: artifact.abi || [],
    bytecode: artifact.bytecode || '0x',
    networks: artifact.networks || {},
    interface: contractInterface,
    functions: contractInterface.functions
  });
  Contract.call(interceptorTarget, constants.AddressZero, artifact.abi, new BaseProvider());
  return ethersBase;
};
