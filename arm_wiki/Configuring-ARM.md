## Configure ARM

ARM's config file is usually located at `/etc/arm/config/arm.yaml`. This path can be changed by setting the [environment variable](https://wiki.archlinux.org/title/Environment_variables) `ARM_CONFIG_FILE`.

`arm.yaml` includes explanations for each option. Pay special attention to the 'directory setup' section and make sure the ARM user has write access to wherever you define these directories.

In case you want to adjust settings specific to audio CDs, you can find the ABCDE config file at `/etc/arm/config/.abcde.conf` unless configured otherwise in `arm.yaml`.

To allow ARM to identify movie/tv titles, register for an [OMDb API key](http://www.omdbapi.com/apikey.aspx) and set the OMDB_API_KEY parameter in the config file.

## AI Configuration (Required)

AI is a **core requirement** for this fork. You must configure an OpenAI-compatible API key:

```yaml
# In arm.yaml
AI_API_KEY: "sk-your-api-key"
AI_API_URL: "https://api.openai.com/v1/chat/completions"
AI_MODEL: "gpt-4o-mini"
```

Or via environment variables (these override `arm.yaml`):

```bash
export ARM_AI_API_KEY=sk-your-api-key
export ARM_AI_API_URL=https://api.openai.com/v1/chat/completions
export ARM_AI_MODEL=gpt-4o-mini
```

**Compatible AI providers:**
- OpenAI (GPT-4o, GPT-4o-mini)
- Any OpenAI-compatible API (Ollama, LM Studio, vLLM, Together AI, etc.)

See [AI Agent](AI-Agent) for full details on AI capabilities.

## MCP Apps Configuration (Optional)

ARM can connect to external [MCP](https://modelcontextprotocol.io) tool servers for additional capabilities. Configure in `arm.yaml`:

```yaml
MCP_APPS:
  - name: "media-db"
    command: "npx"
    args: ["-y", "@some/media-db-mcp-server"]
  - name: "file-organizer"
    command: "node"
    args: ["/path/to/organizer-server.js"]
```

Or via environment variable (JSON format):

```bash
export ARM_MCP_APPS='[{"name":"media-db","command":"npx","args":["-y","@some/media-db-mcp-server"]}]'
```

See [MCP Integration](MCP-Integration) for full details.

## Notifications

A lot of random problems are found in the sysmail, email alerting is a most effective method for debugging and monitoring.

I recommend you install postfix from here:http://mhawthorne.net/posts/2011-postfix-configuring-gmail-as-relay/

Then configure /etc/aliases 
	e.g.: 
	
	```	
	root: my_email@gmail.com
	arm: my_email@gmail.com
	userAccount: my_email@gmail.com
	```
	
Run below to pick up the aliases

	```
	sudo newaliases
	```
## Apprise notifications

You can enable Apprise notifications by editing your arm.yaml file. 
You will need to find
 
`APPRISE: ""`

Then add your apprise.yaml file to here like so.

`APPRISE: "/opt/arm/apprise.yaml"`

A sample apprise has been included with arm but is not enabled by default, you can find this file in the doc folder of your arm installation.
You can find how to get the keys/setting up the apprise.yaml from here https://github.com/caronc/apprise/wiki