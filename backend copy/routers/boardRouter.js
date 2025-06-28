const express = require('express');
const boardController = require('../controllers/boardController');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Board API is running', timestamp: new Date().toISOString() });
});

router.post('/boards', auth, boardController.createBoard);
router.get('/boards/:id', boardController.getBoardById);
router.get('/boards/:id/data', boardController.getBoardData);
router.post('/boards/:id', boardController.updateBoard);
router.post('/boards/:id/auth', auth, boardController.updateBoard);
router.delete('/boards/:id', auth, boardController.deleteBoard);

module.exports = router;
