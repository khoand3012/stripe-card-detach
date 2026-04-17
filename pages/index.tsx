import Head from "next/head";
import { SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

type TabKey = "detach" | "config";

type LogType = "info" | "error" | "success";

interface LogEntry {
  type: LogType;
  message: string;
  timestamp: string;
}

interface ConfigState {
  apiUrl: string;
  requestId: string;
  stripeKey: string;
}

type StoredConfigState = Pick<ConfigState, "apiUrl" | "requestId">;

const STORAGE_KEY = "detach-pm.config";
const DEVICE_ID_STORAGE_KEY = "detach-pm.device-id";

const emptyConfig: ConfigState = {
  apiUrl: "",
  requestId: "",
  stripeKey: "",
};

const tabBaseClass =
  "rounded-full border-0 px-4 py-2.5 transition duration-150 ease-out hover:-translate-y-0.5";

const inputClassName =
  "w-full rounded-2xl border border-[rgba(28,35,51,0.14)] bg-white px-4 py-3.5 text-ink transition focus:border-[rgba(43,93,184,0.5)] focus:outline-none focus:ring-4 focus:ring-[rgba(43,93,184,0.1)]";

const primaryButtonClassName =
  "rounded-full border-0 bg-gradient-to-br from-accent to-accent-deep px-4 py-3 font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70";

const secondaryButtonClassName =
  "rounded-full border-0 bg-[rgba(43,93,184,0.1)] px-4 py-3 font-bold text-info transition hover:-translate-y-0.5";

const ghostButtonClassName =
  "rounded-full border-0 bg-[rgba(28,35,51,0.06)] px-4 py-3 text-ink transition hover:-translate-y-0.5";

function getLogToneClass(type: LogType) {
  if (type === "success") {
    return "text-[#8ce2a8]";
  }

  if (type === "error") {
    return "text-[#ff9b97]";
  }

  return "text-[#97b7ff]";
}

export default function HomePage() {
  const passwordManagerFormRef = useRef<HTMLFormElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("detach");
  const [deviceId, setDeviceId] = useState("");
  const [config, setConfig] = useState<ConfigState>(emptyConfig);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [configStatus, setConfigStatus] = useState(
    "Browser-local settings are empty.",
  );

  useEffect(() => {
    const storedConfig = window.localStorage.getItem(STORAGE_KEY);
    const storedDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
    }

    if (!storedConfig) {
      return;
    }

    try {
      const parsedConfig = JSON.parse(storedConfig) as StoredConfigState;
      setConfig((currentConfig) => ({
        ...currentConfig,
        apiUrl: parsedConfig.apiUrl || "",
        requestId: parsedConfig.requestId || "",
      }));
      setConfigStatus(
        "Loaded API endpoint and request ID from browser storage. Stripe secret key stays out of local storage.",
      );
    } catch {
      setConfigStatus("Saved settings were invalid and were ignored.");
    }
  }, []);

  const configComplete = useMemo(() => {
    return Boolean(config.apiUrl && config.requestId && config.stripeKey);
  }, [config]);

  function appendClientLog(type: LogType, message: string) {
    setLogs((currentLogs) => [
      ...currentLogs,
      {
        type,
        message,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  function updateConfigValue(key: keyof ConfigState, value: string) {
    setConfig((currentConfig) => ({
      ...currentConfig,
      [key]: value,
    }));
  }

  function handleSaveConfig() {
    const storedConfig: StoredConfigState = {
      apiUrl: config.apiUrl,
      requestId: config.requestId,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(storedConfig));
    setConfigStatus(
      "Saved API endpoint and request ID to this browser. Save the Stripe secret key with your browser password manager instead.",
    );
  }

  function handleSaveDeviceId() {
    const trimmedDeviceId = deviceId.trim();

    if (!trimmedDeviceId) {
      appendClientLog("error", "Enter a device ID before saving it.");
      return;
    }

    window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, trimmedDeviceId);
    setDeviceId(trimmedDeviceId);
    appendClientLog("success", "Saved device ID to this browser.");
  }

  function handleGenerateRequestId() {
    updateConfigValue("requestId", uuidv4());
    setConfigStatus("Generated a new request ID.");
  }

  async function handleSaveStripeKey() {
    const trimmedStripeKey = config.stripeKey.trim();

    if (!trimmedStripeKey) {
      setConfigStatus("Enter a Stripe secret key before saving it.");
      return;
    }

    const credentialsContainer = navigator.credentials as
      | (CredentialsContainer & {
          store?: (credential: unknown) => Promise<unknown>;
        })
      | undefined;
    const PasswordCredentialCtor = (
      window as Window & {
        PasswordCredential?: new (form: HTMLFormElement) => unknown;
      }
    ).PasswordCredential;

    if (
      !credentialsContainer?.store ||
      !PasswordCredentialCtor ||
      !passwordManagerFormRef.current
    ) {
      setConfigStatus(
        "This browser does not support direct password-manager prompts here. Use the password field's save prompt if your browser shows one.",
      );
      return;
    }

    try {
      const credential = new PasswordCredentialCtor(
        passwordManagerFormRef.current,
      );
      await credentialsContainer.store(credential);
      setConfigStatus(
        "Prompted your browser password manager to save the Stripe secret key.",
      );
    } catch {
      setConfigStatus(
        "Your browser did not accept the password-manager save request. Use the password field's save prompt if available.",
      );
    }
  }

  async function handleDetach(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedDeviceId = deviceId.trim();
    if (!trimmedDeviceId) {
      setActiveTab("detach");
      setLogs([
        {
          type: "error",
          message: "Enter a device ID before starting.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    if (!configComplete) {
      setActiveTab("config");
      setLogs([
        {
          type: "error",
          message: "Complete the configuration tab before detaching cards.",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    setIsRunning(true);
    setLogs([
      {
        type: "info",
        message: `Submitting detachment job for ${trimmedDeviceId}.`,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch("/api/detach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: trimmedDeviceId,
          config,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Detachment failed");
      }

      setLogs(data.logs);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error";
      appendClientLog("error", message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
      <Head>
        <title>Detach PM</title>
        <meta
          name="description"
          content="Detach Stripe payment methods through a simple web console."
        />
      </Head>
      <main className="mx-auto w-[min(1180px,calc(100vw-32px))] px-0 py-12 md:py-16">
        <section className="overflow-hidden rounded-[28px] border border-[rgba(28,35,51,0.08)] bg-[rgba(255,251,245,0.88)] shadow-panel backdrop-blur-xl">
          <div
            className="flex gap-3 border-b border-[rgba(28,35,51,0.08)] bg-[rgba(255,255,255,0.45)] p-[18px]"
            role="tablist"
            aria-label="Detach tool views"
          >
            <button
              className={`${tabBaseClass} ${
                activeTab === "detach"
                  ? "bg-ink text-white"
                  : "bg-transparent text-muted"
              }`}
              onClick={() => setActiveTab("detach")}
              type="button"
            >
              Detach Run
            </button>
            <button
              className={`${tabBaseClass} ${
                activeTab === "config"
                  ? "bg-ink text-white"
                  : "bg-transparent text-muted"
              }`}
              onClick={() => setActiveTab("config")}
              type="button"
            >
              Config
            </button>
          </div>

          {activeTab === "detach" ? (
            <div className="grid gap-5 p-[22px] lg:grid-cols-[340px_minmax(0,1fr)]">
              <form
                className="rounded-3xl border border-[rgba(28,35,51,0.08)] bg-[#fffaf2] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                onSubmit={handleDetach}
              >
                <div>
                  <p className="mb-2.5 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-accent-deep">
                    Target
                  </p>
                  <h2 className="m-0 text-[1.6rem] leading-[1.1]">Device ID</h2>
                </div>
                <label
                  className="mb-2.5 mt-6 block text-[0.92rem] font-bold"
                  htmlFor="deviceId"
                >
                  Your device ID found in the Shophelp App under Debug Settings
                </label>
                <input
                  id="deviceId"
                  className={inputClassName}
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                />
                <div className="mt-5 grid gap-3 grid-rows-2">
                  <button
                    className={secondaryButtonClassName}
                    onClick={handleSaveDeviceId}
                    type="button"
                  >
                    Save device ID
                  </button>
                  <button
                    className={primaryButtonClassName}
                    disabled={!configComplete || isRunning}
                    type="submit"
                  >
                    {isRunning ? "Detaching..." : "Detach cards"}
                  </button>
                </div>
              </form>

              <section className="flex min-h-[420px] flex-col rounded-3xl border border-[rgba(28,35,51,0.08)] bg-[#fffaf2] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex flex-col items-stretch justify-between gap-5 py-6 md:flex-row md:items-start">
                  <div>
                    <p className="mb-2.5 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-accent-deep">
                      Output
                    </p>
                    <h2 className="m-0 text-[1.6rem] leading-[1.1]">
                      Debug log
                    </h2>
                  </div>
                  <button
                    className={ghostButtonClassName}
                    onClick={() => setLogs([])}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-[18px] flex-1 overflow-auto rounded-[20px] bg-[linear-gradient(180deg,rgba(17,22,34,0.96),rgba(24,31,46,0.98))] p-[18px] font-mono text-[#edf3ff]">
                  {logs.length === 0 ? (
                    <p className="m-0 text-[rgba(237,243,255,0.6)]">
                      No run output yet.
                    </p>
                  ) : (
                    logs.map((log, index) => (
                      <div
                        className="grid gap-1 border-b border-b-[rgba(255,255,255,0.06)] py-1.5 last:border-b-0 md:grid-cols-[104px_1fr] md:gap-3"
                        key={`${log.timestamp}-${index}`}
                      >
                        <span className="whitespace-nowrap text-[rgba(237,243,255,0.52)]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={getLogToneClass(log.type)}>
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <section className="m-[22px] rounded-3xl border border-[rgba(28,35,51,0.08)] bg-[#fffaf2] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <div className="flex flex-col items-stretch justify-between gap-5 py-6 md:flex-row md:items-start">
                <div>
                  <p className="mb-2.5 text-[0.82rem] font-bold uppercase tracking-[0.12em] text-accent-deep">
                    Settings
                  </p>
                  <h2 className="m-0 text-[1.6rem] leading-[1.1]">
                    Execution config
                  </h2>
                </div>
                <p className="text-[0.92rem] leading-6 text-muted">
                  {configStatus}
                </p>
              </div>
              <form
                className="grid gap-[18px] pt-2"
                onSubmit={(event) => event.preventDefault()}
                ref={passwordManagerFormRef}
              >
                <input
                  aria-hidden="true"
                  autoComplete="username"
                  className="hidden"
                  name="username"
                  readOnly
                  tabIndex={-1}
                  type="text"
                  value="detach-pm"
                />
                <label className="block">
                  <span className="mb-2.5 mt-6 block text-[0.92rem] font-bold">
                    API endpoint
                  </span>
                  <input
                    autoComplete="off"
                    className={inputClassName}
                    name="api-url"
                    value={config.apiUrl}
                    onChange={(event) =>
                      updateConfigValue("apiUrl", event.target.value)
                    }
                    placeholder="https://your-api-endpoint/payment/payment-methods"
                  />
                </label>
                <label className="block">
                  <span className="mb-2.5 mt-6 block text-[0.92rem] font-bold">
                    Request ID
                  </span>
                  <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                    <input
                      autoComplete="off"
                      className={inputClassName}
                      name="request-id"
                      value={config.requestId}
                      onChange={(event) =>
                        updateConfigValue("requestId", event.target.value)
                      }
                      placeholder="2c0a15f1-d246-48d5-8039-fb8e282c8e1d"
                    />
                    <button
                      className={secondaryButtonClassName}
                      onClick={handleGenerateRequestId}
                      type="button"
                    >
                      Generate
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2.5 mt-6 block text-[0.92rem] font-bold">
                    Stripe secret key
                  </span>
                  <input
                    autoComplete="current-password"
                    className={inputClassName}
                    name="password"
                    type="password"
                    value={config.stripeKey}
                    onChange={(event) =>
                      updateConfigValue("stripeKey", event.target.value)
                    }
                    placeholder="sk_test_..."
                  />
                  <span className="mt-2 block text-sm leading-6 text-muted">
                    This key is not saved to local storage. Use your browser
                    password manager to save it securely.
                  </span>
                </label>
              </form>
              <div className="mt-6 flex flex-col items-stretch justify-between gap-4 md:flex-row md:items-center">
                <div className="flex flex-col gap-3 md:flex-row">
                  <button
                    className={primaryButtonClassName}
                    onClick={handleSaveConfig}
                    type="button"
                  >
                    Save settings
                  </button>
                </div>
              </div>
            </section>
          )}
        </section>
      </main>
    </>
  );
}
