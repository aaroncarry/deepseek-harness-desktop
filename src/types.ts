/** Launch configuration for the managed DeepSeek Harness process. */
export interface HarnessLaunchConfig {
  /** A Node.js executable compatible with the bundled Harness runtime. */
  readonly nodeExecutable: string
  /** Absolute path to the built dsh CLI entrypoint. */
  readonly cliEntrypoint: string
  /** Dedicated Harness home for this Desktop installation. */
  readonly harnessHome: string
  /** Working directory used by the initial host process. */
  readonly workspace: string
  /** Additional process environment values. */
  readonly environment?: Readonly<Record<string, string | undefined>>
  /** Maximum startup time before the process is stopped. */
  readonly startupTimeoutMs?: number
}

/** A running Desktop-managed Harness endpoint. */
export interface HarnessEndpoint {
  /** Loopback URL printed by the Web profile after it is ready. */
  readonly url: URL
}
