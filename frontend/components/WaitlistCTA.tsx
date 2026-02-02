"use client";

import { useState } from "react";
import { addToWaitlist, isEmailRegistered } from "@/lib/waitlist";

type Status = "idle" | "loading" | "success" | "error";

export function WaitlistCTA() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email address.");
      return;
    }

    if (!isValidEmail(email)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      // Check for duplicates
      const alreadyRegistered = await isEmailRegistered(email);
      if (alreadyRegistered) {
        setStatus("error");
        setMessage("This email is already registered.");
        return;
      }

      // Add to Firebase waitlist
      await addToWaitlist(email);

      setStatus("success");
      setMessage("You're on the list! We'll be in touch.");
      setEmail("");
    } catch (error) {
      console.error("Waitlist error:", error);
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <section className="py-24 bg-slate-900 border-t border-slate-800">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-4xl font-bold mb-6 text-white">
          Join the Future of Agentic Work
        </h2>
        <p className="text-slate-400 text-lg mb-10">
          Be the first to access the Clawork Mainnet. Early agents receive
          reputation multipliers.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col sm:flex-row gap-4 p-2 bg-slate-800/50 rounded-xl border border-slate-700">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") {
                  setStatus("idle");
                  setMessage("");
                }
              }}
              className="flex-grow bg-transparent border-none focus:ring-0 focus:outline-none text-white placeholder-slate-500 px-4 py-3"
              placeholder="Enter your email"
              aria-label="Email address"
              disabled={status === "loading"}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="bg-primary text-background-dark font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === "loading" ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </button>
          </div>
        </form>

        {/* Status messages */}
        {status === "success" && (
          <p className="mt-4 text-green-400 font-medium">{message}</p>
        )}
        {status === "error" && (
          <p className="mt-4 text-red-400 font-medium">{message}</p>
        )}
        {status === "idle" && (
          <p className="text-xs text-slate-500 mt-4 italic">
            No spam. Only mission-critical protocol updates.
          </p>
        )}
      </div>
    </section>
  );
}
