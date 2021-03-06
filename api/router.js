import { Router } from 'express';
import StravaService from '../services/strava';
import _ from 'lodash';
import util from 'util';
import mongoose from 'mongoose';
import Activity from '../models/Activity';
import Report from '../models/Report';
import findStoplights from '../services/findStoplights';
import synchronizeActivity from '../services/synchronizeActivity';
import processNewActivities from '../services/processNewActivities';
import sendActivityToCoreService from '../services/sendActivityToCoreService';
import fetchUsersFromIdentityService from '../services/fetchUsersFromIdentityService';
import emailReport from '../services/emailReport';
import Promise from 'bluebird';
import R from 'ramda';
import { Observable } from 'rx';
import { db } from  '../initializers/mongoose';

const strava = new StravaService();
const router = new Router();

router.get('/', (req, res, next) => {
  // Am I up?
  res.send('API up!');
});

router.get('/activities', (req, res, next) => {
  Activity.find({})
  .sort({ activityId: 'desc' })
  .then((activities) => res.send(activities))
});

router.get('/reports', (req, res, next) => {
  Report.find({})
  .sort({ activityId: 'desc' })
  .then((reports) => res.send(reports))
});

router.delete('/reports', (req, res, next) => {
  Report.remove({})
  .then(out => res.status(202).send(out))
})

router.post('/synchronization', (req, res, next) => {
  return fetchUsersFromIdentityService()
  .concatMap(({ email, strava_access_token }) => {
    return R.pipe(
      R.always(strava_access_token),
      strava.activities,
      Observable.fromPromise,
      R.curry(synchronizeActivity)(R.__, strava_access_token, strava),
      R.curry(processNewActivities)(R.__, strava_access_token, strava),
      sendActivityToCoreService,
      emailReport
    )();
  })
  .toArray()
  .subscribe(
    (report) => res.status(202).send(report),
    (err) => res.status(500).send(err)
  )
});

router.get('/activities/:id/stoplights', (req, res, next) => {
  strava.activityZipped(req.params.id).then((zipped) => {
    return findStoplights(zipped)
  })
  .then((stoplights) => {
    res.send(stoplights);
  })
  .catch((err) => res.send(err));
});

router.get('/activities/:id/stream', (req, res, next) => {
  // - Hit Strava API
  // - Query for list of commutes
  // - Save new commutes (id, streamdata) in db
  const id = req.params.id
  strava.activityZipped(id).then((data) => {
    res.send(data);
  })
  .catch((err) => res.send(err));
});

router.get('/stravaActivities', (req, res, next) => {
  strava.activities().then((data) => {
    res.send(data);
  });
});

router.get('/ingest', (req, res, next) => {
  // - For commutes without reports
  // - generate report
  // - save report
  console.log("Ingesting...");
});

router.get('/send', (req, res, next) => {
  // - email reports that have not been emailed
});

export default router;
