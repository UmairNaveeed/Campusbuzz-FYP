import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  getMyLists,
  getListById,
  createList,
  updateList,
  deleteList,
  addMembers,
  removeMembers,
  getListFeed,
} from '../controllers/listController.js';

const router = express.Router();

router.get('/', verifyFirebaseToken, getMyLists);
router.post('/', verifyFirebaseToken, createList);
router.get('/:listId/feed', verifyFirebaseToken, getListFeed);
router.get('/:listId', verifyFirebaseToken, getListById);
router.patch('/:listId', verifyFirebaseToken, updateList);
router.delete('/:listId', verifyFirebaseToken, deleteList);
router.post('/:listId/members', verifyFirebaseToken, addMembers);
router.delete('/:listId/members', verifyFirebaseToken, removeMembers);

export default router;
