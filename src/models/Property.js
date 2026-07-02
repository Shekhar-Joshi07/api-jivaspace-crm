import mongoose from 'mongoose';
const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['Apartment','Villa','Plot','Commercial','Office','Shop'], required: true },
  location: { type: String, required: true },
  price: { type: Number, required: true },
  size: String,
  bedrooms: Number,
  status: { type: String, enum: ['Available','Sold','Booked','Hold'], default: 'Available' },
  description: String,
  ownerName: String,
  ownerPhone: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
export default mongoose.model('Property', propertySchema);
