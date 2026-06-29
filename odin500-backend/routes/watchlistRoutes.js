const express = require('express');
const router = express.Router();
const {
    createWatchlist,
    getMyWatchlists,
    addTickerToWatchlist,
    removeTickerFromWatchlist,
    getDefaultWatchlists,
    deleteWatchlist,
    updateWatchlist
} = require('../controllers/watchlistController');
const { requireAuthStrict } = require('../middleware/authMiddleware');

// defaults are public
router.get('/defaults', getDefaultWatchlists); // Fetch the five built-in watchlists

// User watchlists always require a real session (ignores AUTH_DISABLED)
router.use(requireAuthStrict); 

router.post('/', createWatchlist); // Create new watchlist
router.get('/', getMyWatchlists); // Get all my watchlists
router.post('/add', addTickerToWatchlist); // Add stock(s) to watchlist
router.delete('/:watchlist_id/remove/:ticker_id', removeTickerFromWatchlist); // Remove one stock
router.patch('/:watchlist_id', updateWatchlist); // Update name and/or replace tickers
router.delete('/:watchlist_id', deleteWatchlist); // Delete entire watchlist

module.exports = router;