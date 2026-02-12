# ARM Job Management
<!-- TOC -->
* [ARM Job Management](#arm-job-management)
  * [Overview](#overview)
  * [Main Page](#main-page)
  * [AI-Powered Features](#ai-powered-features)
  * [Jobs Page](#jobs-page)
    * [Job Modes](#job-modes)
      * [Auto (Default)](#auto-default)
      * [Manual](#manual)
<!-- TOC -->

## Overview

The ARM Jobs page provides an overview of all ripping jobs — active, completed, and failed.
Jobs are automatically created when a disc is inserted and detected by ARM.

In the Node.js AI-first fork, jobs benefit from AI-powered disc identification, transcode optimization, error diagnosis, and file naming throughout their lifecycle.

## Main Page

The ARM home page shows all currently processing jobs and options to edit or fix metadata.
Any new jobs will automatically show up on this page, with the data refreshed per the UI Settings refresh rate.
See [UI Settings](Web-Settings-UI) for more details.

1. Abandon Job — Stop ARM processing the job, will kill any ripping or transcoding job
2. View logfile — Open up the current job logfile in the browser
3. Title Search — Fix the title (AI identification usually handles this automatically)
4. Custom Title — For discs or jobs that are not standard, set a custom title
5. Edit Settings — Edit ripper or other settings (needs to be early on in the job)

## AI-Powered Features

Throughout a job's lifecycle, ARM uses AI agents to automate key decisions:

| Stage | AI Capability | Description |
|-------|--------------|-------------|
| **Identification** | `parseDiscLabel` | Automatically parses cryptic disc labels into clean titles |
| **Pre-Transcode** | `recommendTranscodeSettings` | Analyzes video metadata to recommend optimal settings |
| **On Error** | `diagnoseError` | Provides human-readable error diagnosis with fix suggestions |
| **Post-Rip** | `generateMediaFilename` | Creates Plex/Emby/Jellyfin-compatible file/folder names |

See [AI Agent](AI-Agent) for details on each capability.

## Jobs Page

The Jobs page shows any current or already completed jobs in detail.

### Job Tracks

The track listing against A.R.M jobs lists music or video files that are to be processed.
When running in Manual mode, additional configuration options are provided (detailed below), to rip single tracks.

<img title="Job track details" alt="Music job tracks" src="images/jobs_jobspage_music_tracks.png" width="50%" height=""/>

### Job Modes

A.R.M has two modes, automatic (default) and manual, allowing for additional configuration over jobs and drives.
For details on how to view and change job types, see [Drive Management](Web-Settings-Drives).

#### Auto (Default)

A.R.M does not stop at any point for user input,
using the Ripper Configuration provided any jobs will power through till the end.

#### Manual

When set to manual, A.R.M will pause and wait for user input on what jobs to process.
The process follows:

1. Job starts
2. Track information is read from the disk
3. Job is paused, waiting for user input on which tracks to select

> [!NOTE]
> A.R.M will wait for 30 minutes for input. If no input is provided the job will be abandoned.
> Reminders will be sent every 5 minutes that the job is waiting for input

4. **User interaction** Select and save tracks to rip.
   The below image shows the track selection options, select one or more tracks in the 'Process' column then select update.

> [!NOTE]
> Only one track selection can be conducted, once updated there is no going back.

<img title="Manual Job - Track Edit" alt="Manual job with track edit" src="images/jobs_jobspage_dvd_process_enabled.png" width="50%" height=""/>

5. Job continues on, ripping and transcoding like normal

Once a job has been completed user selection of tracks is not possible, with the track 'Process' selection disabled.

<img title="Manual Job - no edit" alt="Manual job with no user edit" src="images/jobs_jobspage_dvd_process_disabled.png" width="50%" height=""/>
