import Activity from '../models/Activity';
import { Observable } from 'rx';
import { inspect } from 'util';

/**
 * Synchronizes from Strava to our internal Activity db.
 */
export default function synchronizeActivity(activities$, accessToken, strava) {
  return activities$
  .flatMap(result => result)
  .filter(activity => activity.type === 'Ride')
  .tap(v => console.log('[synchronizeActivity] Fetching stream for activity', v.id))
  .flatMap(activity => {
    return Observable.fromPromise(
      Activity.findOne({activityId: activity.id})
    )
    .map(result => {
      return { result, activity }
    })
  })
  .filter(({result, activity}) => result === null)
  .concatMap(activity => Observable.just(activity).delay(7000))
  .flatMap(({activity}) => {
    return Observable.fromPromise(
      strava.activityZipped(activity.id, accessToken)
      .then(stream => {
        return { activity, stream }
      })
    )
    .catch(v => {
      console.error('[synchronizeActivity] Error:', v, v.stack);
      return Observable.empty();
    })
  })
  .map((res) => {
    const { activity, stream } = res;
    return Activity.findOneAndUpdate({
      activityId: activity.id
    }, {
      name: activity.name,
      type: activity.type,
      commute: activity.commute,
      activity: activity,
      stream: stream,
    }, {
      upsert: true,
      new: true
    })
  })
  .flatMap(query => {
    return Observable.fromPromise(query)
  })
  .tap(r => console.log(`[synchronizeActivity]: Saved Activity: ${r.activity.id}`))
};
