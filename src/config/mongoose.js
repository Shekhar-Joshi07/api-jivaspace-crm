import mongooseDefault from 'mongoose/index.js';
import * as mongooseNamespace from 'mongoose/index.js';

const mongoose = typeof mongooseDefault?.set === 'function'
  ? mongooseDefault
  : typeof mongooseNamespace.default?.set === 'function'
    ? mongooseNamespace.default
    : mongooseNamespace;

export default mongoose;
