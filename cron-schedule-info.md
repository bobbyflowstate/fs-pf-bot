# Playlist Cron Job Schedule

## Configuration
- **Cron Expression**: `0 7 * * *`
- **Vercel Endpoint**: `/api/playlist-cron`
- **Max Duration**: 30 seconds

## Schedule Breakdown
- `0` - At minute 0 (top of the hour)
- `7` - At hour 7 (7 AM)
- `*` - Every day of the month
- `*` - Every month
- `*` - Every day of the week

## Time Zones
- **UTC Time**: 7:00 AM
- **CET (Winter)**: 8:00 AM (UTC+1)
- **CEST (Summer)**: 9:00 AM (UTC+2) ✅ Target time

## What Happens
1. Vercel triggers the cron job daily at 7 AM UTC
2. The function calls `postDailyPlaylists()`
3. Fetches from 3 FS Composer API endpoints
4. Posts playlists that match today's date to the music topic
5. If no playlists available, does nothing (silent)

## Manual Testing
You can manually trigger the cron job by visiting:
`https://your-domain.vercel.app/api/playlist-cron`

## Monitoring
Check Vercel function logs to see:
- When cron job runs
- Whether playlists were found and posted
- Any API errors or issues