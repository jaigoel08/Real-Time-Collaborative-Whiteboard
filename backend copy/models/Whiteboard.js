const mongoose = require('mongoose');

// Schema for individual shapes/drawings
const shapeSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['pen', 'rect', 'circle', 'arrow', 'star', 'polygon', 'ellipse', 'text', 'image', 'eraser']
  },
  // Position and dimensions
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  radius: { type: Number, default: 0 },
  points: { type: [Number], default: [] }, // For pen, arrow, polygon
  
  // Styling properties
  stroke: { type: String, default: '#000000' },
  fill: { type: String, default: '#ffffff' },
  strokeWidth: { type: Number, default: 3 },
  opacity: { type: Number, default: 1, min: 0, max: 1 },
  
  // Text properties
  text: { type: String, default: '' },
  fontSize: { type: Number, default: 16 },
  fontFamily: { type: String, default: 'Arial' },
  fontStyle: { type: String, enum: ['normal', 'bold', 'italic'], default: 'normal' },
  
  // Image properties
  imageUrl: { type: String, default: '' },
  imageWidth: { type: Number, default: 0 },
  imageHeight: { type: Number, default: 0 },
  
  // Shape-specific properties
  sides: { type: Number, default: 6 }, // For polygon
  innerRadius: { type: Number, default: 0 }, // For star
  outerRadius: { type: Number, default: 0 }, // For star
  numPoints: { type: Number, default: 5 }, // For star
  
  // Filters and effects
  filters: { type: [String], default: [] },
  blurRadius: { type: Number, default: 0 },
  
  // Animation properties
  animation: {
    type: { type: String, enum: ['fade', 'slide', 'rotate', 'scale', 'bounce', 'none'], default: 'none' },
    duration: { type: Number, default: 1000 }, // milliseconds
    delay: { type: Number, default: 0 },
    easing: { type: String, default: 'linear' },
    isPlaying: { type: Boolean, default: false }
  },
  
  // Transform properties
  rotation: { type: Number, default: 0 },
  scaleX: { type: Number, default: 1 },
  scaleY: { type: Number, default: 1 },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  zIndex: { type: Number, default: 0 } // Layer order
});

// Schema for board layers
const layerSchema = new mongoose.Schema({
  name: { type: String, default: 'Layer 1' },
  visible: { type: Boolean, default: true },
  locked: { type: Boolean, default: false },
  opacity: { type: Number, default: 1, min: 0, max: 1 },
  shapes: [shapeSchema],
  zIndex: { type: Number, default: 0 }
});

// Schema for board history (undo/redo)
const historySchema = new mongoose.Schema({
  action: { type: String, required: true }, // 'add', 'delete', 'modify'
  shapes: [shapeSchema],
  timestamp: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Main Whiteboard schema
const whiteboardSchema = new mongoose.Schema({
  // Basic board information
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  
  // Board settings
  width: { type: Number, default: 1200 },
  height: { type: Number, default: 800 },
  backgroundColor: { type: String, default: '#ffffff' },
  gridEnabled: { type: Boolean, default: false },
  gridSize: { type: Number, default: 20 },
  
  // Board content
  layers: [layerSchema],
  currentLayerIndex: { type: Number, default: 0 },
  
  // History for undo/redo
  history: [historySchema],
  historyIndex: { type: Number, default: -1 },
  maxHistorySize: { type: Number, default: 50 },
  
  // Collaboration
  isCollaborative: { type: Boolean, default: true },
  maxCollaborators: { type: Number, default: 10 },
  collaborators: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['viewer', 'editor', 'admin'], default: 'editor' },
    joinedAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
  }],
  
  // Access control
  isPublic: { type: Boolean, default: false },
  isReadOnly: { type: Boolean, default: false },
  password: { type: String, default: '' }, // For password-protected boards
  
  // Ownership
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Board state
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  
  // Metadata
  tags: { type: [String], default: [] },
  category: { type: String, default: 'general' },
  version: { type: String, default: '1.0.0' },
  
  // Statistics
  viewCount: { type: Number, default: 0 },
  editCount: { type: Number, default: 0 },
  lastEdited: { type: Date, default: Date.now },
  lastViewed: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for getting current layer
whiteboardSchema.virtual('currentLayer').get(function() {
  return this.layers[this.currentLayerIndex] || this.layers[0];
});

// Virtual for getting all shapes from all layers
whiteboardSchema.virtual('allShapes').get(function() {
  return this.layers.reduce((shapes, layer) => {
    return shapes.concat(layer.shapes);
  }, []);
});

// Indexes for better query performance
whiteboardSchema.index({ owner: 1, createdAt: -1 });
whiteboardSchema.index({ 'collaborators.user': 1 });
whiteboardSchema.index({ isPublic: 1, isActive: 1 });
whiteboardSchema.index({ tags: 1 });
whiteboardSchema.index({ category: 1 });

// Pre-save middleware to update timestamps
whiteboardSchema.pre('save', function(next) {
  this.lastEdited = new Date();
  next();
});

// Method to add a shape to the current layer
whiteboardSchema.methods.addShape = function(shapeData) {
  const currentLayer = this.layers[this.currentLayerIndex];
  if (currentLayer && !currentLayer.locked) {
    shapeData.createdAt = new Date();
    shapeData.updatedAt = new Date();
    currentLayer.shapes.push(shapeData);
    this.editCount++;
    return true;
  }
  return false;
};

// Method to remove a shape
whiteboardSchema.methods.removeShape = function(shapeId) {
  const currentLayer = this.layers[this.currentLayerIndex];
  if (currentLayer && !currentLayer.locked) {
    const shapeIndex = currentLayer.shapes.findIndex(shape => shape._id.toString() === shapeId);
    if (shapeIndex !== -1) {
      currentLayer.shapes.splice(shapeIndex, 1);
      this.editCount++;
      return true;
    }
  }
  return false;
};

// Method to add layer
whiteboardSchema.methods.addLayer = function(layerName = `Layer ${this.layers.length + 1}`) {
  const newLayer = {
    name: layerName,
    visible: true,
    locked: false,
    opacity: 1,
    shapes: [],
    zIndex: this.layers.length
  };
  this.layers.push(newLayer);
  return this.layers.length - 1;
};

// Method to save to history
whiteboardSchema.methods.saveToHistory = function(action, shapes, userId) {
  const historyEntry = {
    action,
    shapes: shapes.map(shape => shape.toObject ? shape.toObject() : shape),
    timestamp: new Date(),
    userId
  };
  
  // Remove future history if we're not at the end
  if (this.historyIndex < this.history.length - 1) {
    this.history = this.history.slice(0, this.historyIndex + 1);
  }
  
  this.history.push(historyEntry);
  this.historyIndex = this.history.length - 1;
  
  // Limit history size
  if (this.history.length > this.maxHistorySize) {
    this.history.shift();
    this.historyIndex--;
  }
};

// Method to undo
whiteboardSchema.methods.undo = function() {
  if (this.historyIndex > 0) {
    this.historyIndex--;
    return this.history[this.historyIndex];
  }
  return null;
};

// Method to redo
whiteboardSchema.methods.redo = function() {
  if (this.historyIndex < this.history.length - 1) {
    this.historyIndex++;
    return this.history[this.historyIndex];
  }
  return null;
};

// Static method to find boards by user
whiteboardSchema.statics.findByUser = function(userId) {
  return this.find({
    $or: [
      { owner: userId },
      { 'collaborators.user': userId }
    ]
  }).populate('owner', 'name email avatar');
};

// Static method to find public boards
whiteboardSchema.statics.findPublic = function() {
  return this.find({
    isPublic: true,
    isActive: true,
    isArchived: false
  }).populate('owner', 'name email avatar');
};

module.exports = mongoose.model('Whiteboard', whiteboardSchema); 