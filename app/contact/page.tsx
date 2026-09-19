"use client";

import { FormEvent, useState } from "react";
import Navbar from "@/app/components/ui/navbar";
import Footer from "@/app/components/ui/footer";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Email/API integration will be added later.
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Navbar />

      <main>
        {/* Header */}
        <section className="bg-slate-950 px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-400">
              Contact
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-6xl">
              We'd love to hear from you
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
              Have a question, feedback, feature request, or need
              help with your SEO audit? Send us a message.
            </p>
          </div>
        </section>

        {/* Contact area */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-5 lg:px-8">
            {/* Contact details */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold">
                Get in touch
              </h2>

              <p className="mt-4 leading-7 text-slate-600">
                We're building this platform to make SEO analysis
                easier for website owners, developers, marketers,
                and agencies.
              </p>

              <div className="mt-10 space-y-7">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    ✉
                  </div>

                  <div>
                    <p className="font-semibold">
                      Email
                    </p>

                    <a
                      href="mailto:support@seoaudit.com"
                      className="mt-1 block text-sm text-slate-600 hover:text-blue-600"
                    >
                      support@seoaudit.com
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    ?
                  </div>

                  <div>
                    <p className="font-semibold">
                      Support
                    </p>

                    <p className="mt-1 text-sm text-slate-600">
                      For product questions and technical support.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    ◎
                  </div>

                  <div>
                    <p className="font-semibold">
                      Social
                    </p>

                    <div className="mt-2 flex gap-4 text-sm">
                      <a
                        href="#"
                        className="text-slate-600 hover:text-slate-900"
                      >
                        X
                      </a>

                      <a
                        href="#"
                        className="text-slate-600 hover:text-slate-900"
                      >
                        LinkedIn
                      </a>

                      <a
                        href="#"
                        className="text-slate-600 hover:text-slate-900"
                      >
                        Facebook
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                {submitted ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
                      ✓
                    </div>

                    <h2 className="mt-5 text-2xl font-bold">
                      Message received
                    </h2>

                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
                      Thanks for reaching out. Our contact system
                      will be connected to email delivery shortly.
                    </p>

                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="mt-6 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold">
                      Send us a message
                    </h2>

                    <p className="mt-2 text-sm text-slate-600">
                      Fill out the form and tell us how we can help.
                    </p>

                    <form
                      onSubmit={handleSubmit}
                      className="mt-8 space-y-5"
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="name"
                            className="mb-2 block text-sm font-medium text-slate-700"
                          >
                            Name
                          </label>

                          <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            placeholder="Your name"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="email"
                            className="mb-2 block text-sm font-medium text-slate-700"
                          >
                            Email
                          </label>

                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            placeholder="you@example.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="subject"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Subject
                        </label>

                        <input
                          id="subject"
                          name="subject"
                          type="text"
                          required
                          className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          placeholder="How can we help?"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="message"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Message
                        </label>

                        <textarea
                          id="message"
                          name="message"
                          required
                          rows={7}
                          className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          placeholder="Tell us more..."
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full rounded-lg bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
                      >
                        Send message
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ/contact reassurance */}
        <section className="border-t border-slate-200 bg-slate-50 py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold">
              Need help with an audit?
            </h2>

            <p className="mt-3 text-slate-600">
              Include the website URL you're auditing and a
              description of the problem when contacting support.
              This will help us understand the issue faster.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}