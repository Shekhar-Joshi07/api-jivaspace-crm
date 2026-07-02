import Team from '../models/Team.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/apiResponse.js';

const populateTeam = query => query
  .populate('manager', 'name email role')
  .populate('members', 'name email role')
  .populate('createdBy', 'name email role');

export const getTeams = async (req, res) => {
  const filter = req.user.role === 'superadmin'
    ? {}
    : req.user.role === 'admin'
      ? { manager: req.user._id }
      : { members: req.user._id };
  const teams = await populateTeam(Team.find(filter).sort('name'));
  return sendSuccess(res, { data: teams });
};

export const createTeam = async (req, res) => {
  const team = await Team.create({ ...req.body, createdBy: req.user._id });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Team created successfully',
    data: await populateTeam(Team.findById(team._id))
  });
};

export const updateTeam = async (req, res) => {
  const team = await populateTeam(Team.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }));
  if (!team) throw new ApiError(404, 'Team not found');
  return sendSuccess(res, { message: 'Team updated successfully', data: team });
};

export const deleteTeam = async (req, res) => {
  const team = await Team.findByIdAndDelete(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');
  return sendSuccess(res, { message: 'Team deleted successfully' });
};
