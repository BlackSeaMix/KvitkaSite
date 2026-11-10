"use client";

import { useEffect, useState } from "react";
import { Phone, MapPin, Clock, Menu, X, Star, Sparkles } from "lucide-react";
import {
  SHOP_NAME,
  TAGLINE,
  HERO_EYEBROW,
  HERO_DESCRIPTION,
  PHONE_DISPLAY,
  PHONE_TEL,
  ADDRESS,
  SERVICE_CATEGORIES,
  BOOKING_DEPOSIT_NOTE,
  BOOKING_DURATION_MINUTES,
  GALLERY_ITEMS,
  HOURS,
  REVIEWS,
} from "./content";

type Slot = { time: string; available: boolean };
type LastBooking = { service: string; date: string; time: string };

function toGoogleCalendarUTC(d: Date): string {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

function buildGoogleCalendarLink(service: string, date: string, time: string): string {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + BOOKING_DURATION_MINUTES * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${SHOP_NAME} — ${service}`,
    dates: `${toGoogleCalendarUTC(start)}/${toGoogleCalendarUTC(end)}`,
    details: `Appointment at ${SHOP_NAME}.`,
    location: ADDRESS,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#gallery", label: "Gallery" },
  { href: "#booking", label: "Book Now" },
  { href: "#hours", label: "Hours & Location" },
  { href: "#contact", label: "Contact" },
];

type BookingStatus = "idle" | "submitting" | "success" | "error";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>("idle");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [lastBooking, setLastBooking] = useState<LastBooking | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!bookingDate) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/availability?date=${bookingDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingDate]);

  async function handleBookingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const service = data.get("service") as string;

    setBookingStatus("submitting");
    setBookingError(null);

    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          contact: data.get("contact"),
          service,
          date: bookingDate,
          time: bookingTime,
          notes: data.get("notes"),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong. Please call us instead.");
      }

      setLastBooking({ service, date: bookingDate, time: bookingTime });
      setBookingStatus("success");
      form.reset();
      setBookingDate("");
      setBookingTime("");
      setSlots([]);
    } catch (err) {
      setBookingStatus("error");
      setBookingError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="min-h-screen bg-ink text-cream">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-ink/90 backdrop-blur border-b border-cream/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flower-mark.png" alt="" className="h-7 w-7 shrink-0" />
            {SHOP_NAME}
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-cream/70">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-cream transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href={PHONE_TEL}
            className="hidden md:inline-flex items-center gap-2 bg-brandYellow text-ink text-sm font-semibold px-4 py-2 rounded-lg shadow-sm shadow-black/20 hover:brightness-95 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            <Phone className="h-4 w-4" />
            {PHONE_DISPLAY}
          </a>

          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden p-2 -mr-2 rounded-full text-brandYellow hover:bg-cream/10 active:bg-cream/20 transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-cream/10 px-6 py-4 flex flex-col gap-4 text-sm font-medium text-cream/70">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="hover:text-cream transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a href={PHONE_TEL} className="flex items-center gap-2 text-cream font-semibold">
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </a>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-ink" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-painting.webp"
          alt=""
          className="absolute right-0 top-0 h-full w-[42%] md:w-[38%] max-w-md scale-110 object-cover object-top opacity-35 md:opacity-90 pointer-events-none select-none [mask-image:linear-gradient(to_left,black_55%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_left,black_55%,transparent_100%)]"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 md:py-36 text-center">
          <p className="text-brandYellow font-semibold tracking-wide uppercase text-sm mb-4">
            {HERO_EYEBROW}
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-cream mb-6">
            {TAGLINE}
          </h1>
          <p className="text-lg text-cream/80 max-w-xl mx-auto mb-10">
            {HERO_DESCRIPTION}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#booking"
              className="inline-flex items-center gap-2 bg-brandYellow text-ink font-semibold px-6 py-3 rounded-lg shadow-sm shadow-black/20 hover:brightness-95 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Book Now
            </a>
            <a
              href="#services"
              className="inline-flex items-center gap-2 bg-brandYellow text-ink font-semibold px-6 py-3 rounded-lg shadow-sm shadow-black/20 hover:brightness-95 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              View Services
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="max-w-6xl mx-auto px-6 py-20 border-t border-cream/10">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Services & Pricing</h2>
          <p className="text-cream/80">Simple, transparent pricing. No surprises.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {SERVICE_CATEGORIES.map((group) => (
            <div key={group.category} className="bg-primary border-2 border-brandYellow rounded-2xl p-6">
              <h3 className="font-semibold text-ink mb-3">{group.category}</h3>
              <ul className="divide-y divide-black/10">
                {group.items.map((item) => (
                  <li key={item.name} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm text-zinc-700">{item.name}</span>
                      <span className="font-semibold text-black whitespace-nowrap">
                        {item.price}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-xs text-zinc-600 mt-1">{item.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Gallery */}
      <section id="gallery" className="max-w-6xl mx-auto px-6 py-20 border-t border-cream/10">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Gallery</h2>
          <p className="text-cream/80">A look at the work.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {GALLERY_ITEMS.map((item, i) =>
            item.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.alt}
                src={item.src}
                alt={item.alt}
                className="w-full h-full aspect-square rounded-2xl object-cover"
              />
            ) : (
              <div
                key={item.alt}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 ${
                  i % 2 === 0 ? "bg-cream" : "bg-primary"
                }`}
              >
                <Sparkles
                  className={`h-8 w-8 ${i % 2 === 0 ? "text-ink" : "text-brandYellow"}`}
                />
                <span className="text-sm font-medium text-ink">{item.alt}</span>
              </div>
            )
          )}
        </div>
      </section>

      {/* Reviews */}
      {REVIEWS.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-20 border-t border-cream/10">
          <div className="flex flex-col md:flex-row gap-8 justify-center text-center md:text-left">
            {REVIEWS.map((review) => (
              <div key={review.quote} className="flex-1 max-w-sm mx-auto md:mx-0">
                <div className="flex gap-1 mb-3 justify-center md:justify-start">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-brandYellow text-brandYellow" />
                  ))}
                </div>
                <p className="text-cream/80 mb-2">&ldquo;{review.quote}&rdquo;</p>
                <p className="text-sm text-cream/60">{review.name}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Booking */}
      <section id="booking" className="max-w-6xl mx-auto px-6 py-20 border-t border-cream/10">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight mb-3">Book an Appointment</h2>
          <p className="text-cream/80">Pick a service and a time that works for you.</p>
        </div>
        <form onSubmit={handleBookingSubmit} className="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            name="name"
            required
            placeholder="Your name"
            className="sm:col-span-2 bg-white text-ink placeholder:text-zinc-400 border border-zinc-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          <input
            name="contact"
            required
            placeholder="Phone or email"
            className="sm:col-span-2 bg-white text-ink placeholder:text-zinc-400 border border-zinc-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          <select
            name="service"
            required
            defaultValue=""
            className="sm:col-span-2 bg-white text-ink placeholder:text-zinc-400 border border-zinc-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select a service
            </option>
            {SERVICE_CATEGORIES.map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.items
                  .filter((item) => item.price !== "On request")
                  .map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <input
            type="date"
            required
            min={todayStr}
            value={bookingDate}
            onChange={(e) => {
              setBookingDate(e.target.value);
              setBookingTime("");
            }}
            className="bg-white text-ink placeholder:text-zinc-400 border border-zinc-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />
          <select
            required
            value={bookingTime}
            onChange={(e) => setBookingTime(e.target.value)}
            disabled={!bookingDate || slotsLoading}
            className="bg-white text-ink placeholder:text-zinc-400 border border-zinc-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
          >
            <option value="" disabled>
              {!bookingDate ? "Pick a date first" : slotsLoading ? "Loading times…" : "Select a time"}
            </option>
            {slots.map((slot) => (
              <option key={slot.time} value={slot.time} disabled={!slot.available}>
                {slot.time}
                {!slot.available ? " (Booked)" : ""}
              </option>
            ))}
          </select>
          <textarea
            name="notes"
            placeholder="Anything else we should know? (optional)"
            rows={3}
            className="sm:col-span-2 bg-white text-ink placeholder:text-zinc-400 border border-zinc-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
          />

          <button
            type="submit"
            disabled={bookingStatus === "submitting"}
            className="sm:col-span-2 inline-flex items-center justify-center gap-2 bg-brandYellow text-ink font-semibold px-6 py-3 rounded-lg shadow-sm shadow-black/20 hover:brightness-95 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
          >
            {bookingStatus === "submitting" ? "Sending…" : "Request Booking"}
          </button>

          {bookingStatus === "success" && lastBooking && (
            <p className="sm:col-span-2 text-sm text-emerald-600">
              Thanks! We&apos;ve received your request and will confirm shortly.{" "}
              <a
                href={buildGoogleCalendarLink(lastBooking.service, lastBooking.date, lastBooking.time)}
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                + Add to Google Calendar
              </a>
            </p>
          )}
          {bookingStatus === "error" && (
            <p className="sm:col-span-2 text-sm text-red-600">{bookingError}</p>
          )}

          <p className="sm:col-span-2 text-xs text-cream/60 text-center">
            {BOOKING_DEPOSIT_NOTE}
          </p>
        </form>
      </section>

      {/* Hours & Location */}
      <section id="hours" className="max-w-6xl mx-auto px-6 py-20 border-t border-cream/10">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <Clock className="h-6 w-6 text-brandYellow" />
              Opening Hours
            </h2>
            <ul className="divide-y divide-cream/10">
              {HOURS.map((h) => (
                <li key={h.day} className="flex justify-between py-3 text-sm">
                  <span className="text-cream/80">{h.day}</span>
                  <span className="font-medium text-cream">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>

          <div id="contact">
            <h2 className="text-3xl font-semibold tracking-tight mb-6 flex items-center gap-3">
              <MapPin className="h-6 w-6 text-brandYellow" />
              Find Us
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gallery/storefront.jpg"
              alt="Kvitka Centrum storefront"
              className="rounded-2xl mb-4 w-full aspect-video object-cover"
            />
            <div className="rounded-2xl overflow-hidden border border-cream/15 mb-4 aspect-video">
              <iframe
                title="Shop location map"
                className="w-full h-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&output=embed`}
              />
            </div>
            <p className="text-cream/80 mb-4">{ADDRESS}</p>
            <a
              href={PHONE_TEL}
              className="inline-flex items-center gap-2 bg-brandYellow text-ink font-semibold px-6 py-3 rounded-lg shadow-sm shadow-black/20 hover:brightness-95 hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              <Phone className="h-4 w-4" />
              {PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cream/10">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-cream/60">
          <div className="flex items-center gap-2 font-medium text-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flower-mark.png" alt="" className="h-6 w-6 shrink-0" />
            {SHOP_NAME}
          </div>
          <p>&copy; {new Date().getFullYear()} {SHOP_NAME}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
