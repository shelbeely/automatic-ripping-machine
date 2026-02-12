# Frequently Asked Questions

## My ARM won't start when I insert a disc?

When a disc is inserted, udev rules should launch a script that will launch ARM. Here are some basic troubleshooting steps:

- Look for empty.log.
  - Every time you eject the cdrom, an entry should be entered in empty.log like:
  ```
  [2018-08-05 11:39:45] INFO ARM: Drive appears to be empty or is not ready. Exiting ARM.
  ```
  - Empty.log should be in your logs directory as defined in your arm.yaml file. If there is no empty.log file, or entries are not being entered when you eject the cdrom drive, then udev is not launching ARM correctly. Check the instructions and make sure the symlink to 51-automedia.rules is set up right. If you've changed the link or the file contents you need to reload your udev rules with:
  ```
  sudo udevadm control --reload-rules
  ```
- Make sure the ARM user has write permission to the location you have set in your arm.yaml

- Check the ARM logs for errors:
  ```
  tail -f /var/log/syslog
  ```

## AI_API_KEY is required error?

ARM v3.x requires an OpenAI-compatible API key. Set it in `arm.yaml` or via environment variable:

```bash
export ARM_AI_API_KEY=sk-your-api-key
```

See [AI Agent](AI-Agent) for setup details. You can use a free local provider like [Ollama](https://ollama.ai) if you don't want to pay for an API key.

## How do I disable HandBrake encoding?

You can either edit the arm.yaml manually with: `sudo nano /etc/arm/config/arm.yaml` or use the ARM Settings page:

`SKIP_TRANSCODE: false`

Change false to true and save.

## ARM won't eject the DVD until it finishes transcoding

To enable stacking of DVDs there are a couple of settings that must be changed:
 - `RIPMETHOD: "mkv"` and `MAINFEATURE: false`
 - Rip method being set to mkv tells ARM to use MakeMKV to pull the contents to disk (the raw folder). By default ARM will try to transcode straight from the disc.
 - Main feature being turned off tells ARM that it wants everything from the disc and not just the main feature.

The reason these aren't enabled by default is that rip method being set to mkv can cause issues with Blu-rays.

## How do I set up MCP apps?

Configure external MCP tool servers in `arm.yaml`:

```yaml
MCP_APPS:
  - name: "media-db"
    command: "npx"
    args: ["-y", "@some/media-db-mcp-server"]
```

See [MCP Integration](MCP-Integration) for full details.

## I can't get Intel QuickSync / AMD VCE / NVIDIA NVENC to work

See the hardware transcoding guides:
- [Intel QSV](Hardware-Transcode-Intel-QSV)
- [AMD VCE](Hardware-Transcode-AMD-VCE)
- [NVIDIA NVENC](Hardware-Transcode-Nvidia-NVENC)

## Other problems

- Check ARM log files
  - The default location is `/home/arm/logs/` (unless changed in your arm.yaml file) and is named after the disc. These are very verbose.
  - You can change the verbosity in the arm.yaml file. DEBUG will give you more information about what ARM is trying to do.
  - If you are going to post a log for help, please set DEBUG mode and re-run to get the most information.
- You can also use the **AI error diagnosis** feature — paste error logs into the web UI at **AI Tools > AI Dashboard** or call `POST /api/ai/diagnose` with the error log.

If you need any help feel free to open an issue.
