const Board = require('../models/Board');
const { io } = require('../app');

exports.createBoard = async (req, res, next) => {
  try {
    const { name, data } = req.body;
    const board = new Board({ name, data });
    await board.save();
    res.status(201).json(board);
  } catch (err) {
    console.error('Create board error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getBoardById = async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ message: 'Board not found' });
    res.json(board);
  } catch (err) {
    console.error('Get board error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getBoardData = async (req, res, next) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) return res.status(404).json({ message: 'Board not found' });
    res.json(board.data || []);
  } catch (err) {
    console.error('Get board data error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateBoard = async (req, res, next) => {
  try {
    const { data, name } = req.body;
    
    const payloadSize = JSON.stringify(req.body).length;
    console.log(`Payload size: ${payloadSize} bytes`);
    
    if (payloadSize > 50 * 1024 * 1024) { // 50MB limit
      return res.status(413).json({ 
        error: 'Payload too large', 
        size: payloadSize,
        limit: '50MB'
      });
    }
    
    let board = await Board.findById(req.params.id);
    if (!board) {
      board = new Board({ 
        _id: req.params.id,
        name: name || 'New Board', 
        data: data || [] 
      });
    } else {
      board.data = data || board.data;
      if (name) board.name = name;
    }
    
    await board.save();
    res.json(board);
  } catch (err) {
    console.error('Update board error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.deleteBoard = async (req, res, next) => {
  try {
    const board = await Board.findByIdAndDelete(req.params.id);
    if (!board) return res.status(404).json({ message: 'Board not found' });
    io.to(req.params.id).emit('room-ended');
    res.status(204).json({ message: 'Board deleted' });
  } catch (err) {
    console.error('Delete board error:', err);
    res.status(500).json({ error: err.message });
  }
}; 