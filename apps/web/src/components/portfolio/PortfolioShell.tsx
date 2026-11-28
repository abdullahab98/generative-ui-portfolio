'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { resolveSkillIconUrl, type PortfolioThemeSpec } from '@portfolio/shared';
import { API_URL } from '@/lib/api';
import { ContactSection } from './ContactSection';
import { ChatWidget } from './ChatWidget';

interface PortfolioShellProps {
  brandName: string;
  email: string;
  location: string;
  skills: Array<{ name: string; icon_key: string }>;
  ai: { is_enabled: boolean; quick_prompts: string[] };
  theme?: PortfolioThemeSpec;
  epochNumber: number;
  hasHtml: boolean;
}

export function PortfolioShell({
  brandName,
  email,
  location,
  skills,
  ai,
  theme,
  epochNumber,
  hasHtml,
}: PortfolioShellProps) {
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const iframe = document.getElementById('portfolio-frame') as HTMLIFrameElement | null;
    if (!iframe || !hasHtml) return;

    let cleanupDoc: (() => void) | undefined;
    let attachedDoc: Document | null = null;

    const attach = () => {
      const doc = iframe.contentDocument;
      if (!doc || !doc.body || attachedDoc === doc) return;
      cleanupDoc?.();
      attachedDoc = doc;

      const brandTargets = doc.querySelectorAll(
        '.brand-logo, .mobile-brand, .sidebar-brand, nav > a[href="#home"], header > a[href="#home"]',
      );
      for (const brandEl of brandTargets) {
        if (brandEl.querySelector('img, svg')) continue;
        if (brandEl.closest('ul, .nav-links, .portfolio-nav-links, .mobile-overlay, .mobile-menu')) {
          continue;
        }
        const label = (brandEl.textContent || '').trim();
        if (/^(0?\d+\s*[.\-·]?\s*)?home$/i.test(label)) continue;
        const logoImg = doc.createElement('img');
        logoImg.src = '/logo.svg';
        logoImg.alt = brandName || 'Md. Abdullah';
        logoImg.width = 24;
        logoImg.height = 24;
        logoImg.decoding = 'async';
        logoImg.style.cssText =
          'width:24px;height:24px;border-radius:6px;object-fit:contain;vertical-align:middle;margin-right:0.5rem;display:inline-block;flex-shrink:0;';
        brandEl.prepend(logoImg);
      }

      const skillsSection = doc.getElementById('skills');
      if (skillsSection && skills.length > 0) {
        const skillNames = skills.map((s) => s.name.trim().toLowerCase());
        const skillByName = new Map(skills.map((s) => [s.name.trim().toLowerCase(), s]));
        const candidates = skillsSection.querySelectorAll('span, strong, b, h3, h4, p, li, div');
        for (const el of candidates) {
          if (el.querySelector('img, svg')) continue;

          const text = el.textContent?.trim().toLowerCase() || '';
          const matched = skillByName.get(text);
          if (!matched) continue;

          // Only attach to the innermost element containing the exact skill name
          const hasMatchingChild = Array.from(el.children).some(
            (c) => (c.textContent?.trim().toLowerCase() || '') === text,
          );
          if (hasMatchingChild) continue;

          // Skip if this skill's single-item card/row already has an icon (img/svg)
          let alreadyHasIcon = false;
          let ancestor = el.parentElement;
          for (let depth = 0; depth < 3 && ancestor && ancestor !== skillsSection; depth++) {
            const ancestorText = ancestor.textContent?.toLowerCase() || '';
            const hasOtherSkill = skillNames.some(
              (n) => n !== text && !text.includes(n) && ancestorText.includes(n),
            );
            if (hasOtherSkill) break;
            if (ancestor.querySelector('img, svg')) {
              alreadyHasIcon = true;
              break;
            }
            ancestor = ancestor.parentElement;
          }
          if (alreadyHasIcon) continue;

          const icon = doc.createElement('img');
          icon.className = 'portfolio-skill-icon';
          icon.src = resolveSkillIconUrl(matched.name, matched.icon_key);
          icon.alt = matched.name;
          icon.width = 18;
          icon.height = 18;
          icon.loading = 'lazy';
          icon.decoding = 'async';
          const isNext = /next/i.test(matched.name + matched.icon_key);
          icon.style.cssText = `width:18px;height:18px;object-fit:contain;flex-shrink:0;display:inline-block;vertical-align:middle;margin-right:0.45rem;${isNext ? 'background:#ffffff;border-radius:9999px;padding:1px;' : ''}`;
          el.prepend(icon);
        }
      }

      // Ensure mobile hamburger menu toggle works on both AI-generated checkbox/details menus and fallback navs
      const navContainer =
        doc.querySelector('nav') ||
        Array.from(doc.querySelectorAll('header')).find((h) => h.querySelectorAll('a[href^="#"]').length >= 2) ||
        null;

      const aiCheckbox = doc.querySelector(
        'input[type="checkbox"][id*="nav"], input[type="checkbox"][id*="menu"], input[type="checkbox"][class*="nav"], input[type="checkbox"][class*="menu"]',
      ) as HTMLInputElement | null;

      const drawerTarget =
        (doc.querySelector(
          '[class*="mobile-overlay"], [class*="mobile-menu"], [class*="mobile-nav"], [class*="drawer"]',
        ) as HTMLElement | null) ||
        (navContainer?.closest('aside, .sidebar, [class*="sidebar"]') as HTMLElement | null) ||
        navContainer;

      if (aiCheckbox && drawerTarget) {
        const syncDrawer = () => {
          if (!aiCheckbox.checked) {
            drawerTarget.removeAttribute('data-portfolio-drawer-open');
            return;
          }
          const win = doc.defaultView;
          const cs = win?.getComputedStyle(drawerTarget);
          const isHidden =
            !cs ||
            cs.display === 'none' ||
            cs.visibility === 'hidden' ||
            cs.opacity === '0' ||
            drawerTarget.getBoundingClientRect().right <= 0;
          if (isHidden) {
            drawerTarget.setAttribute('data-portfolio-drawer-open', 'true');
          }
        };
        aiCheckbox.addEventListener('change', syncDrawer);
      }

      if (
        navContainer &&
        !aiCheckbox &&
        !doc.querySelector('details[class*="nav"], details[class*="menu"]') &&
        !navContainer.querySelector('input[type="checkbox"], details, .portfolio-mobile-toggle')
      ) {
        const hashLinks = Array.from(navContainer.querySelectorAll('a[href^="#"]'));
        if (hashLinks.length >= 2) {
          const listContainer =
            navContainer.querySelector('ul') ||
            (hashLinks[0].parentElement && hashLinks[0].parentElement !== navContainer
              ? hashLinks[0].parentElement
              : null);

          if (listContainer) {
            listContainer.classList.add('portfolio-nav-links');
          } else {
            const wrapper = doc.createElement('div');
            wrapper.className = 'portfolio-nav-links';
            wrapper.style.cssText = 'display:flex;align-items:center;gap:1rem;flex-wrap:wrap;';
            for (const link of hashLinks) {
              wrapper.appendChild(link);
            }
            navContainer.appendChild(wrapper);
          }

          navContainer.classList.add('portfolio-has-mobile-toggle');
          navContainer.setAttribute('data-mobile-open', 'false');

          const toggleBtn = doc.createElement('button');
          toggleBtn.type = 'button';
          toggleBtn.className = 'portfolio-mobile-toggle';
          toggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
          toggleBtn.setAttribute('aria-expanded', 'false');
          const menuSvg =
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
          const closeSvg =
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
          toggleBtn.innerHTML = menuSvg;

          toggleBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const isOpen = navContainer.getAttribute('data-mobile-open') === 'true';
            const nextOpen = !isOpen;
            navContainer.setAttribute('data-mobile-open', nextOpen ? 'true' : 'false');
            toggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
            toggleBtn.innerHTML = nextOpen ? closeSvg : menuSvg;
          });

          const linksEl = navContainer.querySelector('.portfolio-nav-links');
          if (linksEl) {
            navContainer.insertBefore(toggleBtn, linksEl);
          } else {
            navContainer.appendChild(toggleBtn);
          }
        }
      }

      const showFormFeedback = (form: HTMLFormElement, text: string, isError: boolean) => {
        let box = form.querySelector('.portfolio-form-feedback') as HTMLElement | null;
        if (!box) {
          box = doc.createElement('p');
          box.className = 'portfolio-form-feedback';
          box.style.cssText = 'margin-top:0.75rem;font-size:0.85rem;font-family:monospace;line-height:1.4;';
          form.appendChild(box);
        }
        box.textContent = text;
        box.style.color = isError ? '#f87171' : '#34d399';
      };

      const submitInlineContactForm = async (form: HTMLFormElement, triggerEl?: HTMLElement | null) => {
        const emailInput =
          (form.querySelector('input[type="email"]') as HTMLInputElement | null) ||
          (form.querySelector('input[id*="email" i], input[name*="email" i], input[placeholder*="email" i]') as HTMLInputElement | null);
        const subjectInput = form.querySelector(
          'input[id*="subject" i], input[name*="subject" i], input[placeholder*="subject" i]',
        ) as HTMLInputElement | null;
        const textInputs = Array.from(form.querySelectorAll('input')).filter(
          (inp) => inp !== emailInput && inp !== subjectInput && inp.type !== 'hidden' && inp.type !== 'submit',
        );
        const nameInput =
          (form.querySelector('input[id*="name" i], input[name*="name" i], input[placeholder*="name" i]') as HTMLInputElement | null) ||
          textInputs[0] ||
          null;
        const messageInput =
          (form.querySelector('textarea') as HTMLTextAreaElement | null) ||
          (form.querySelector('input[id*="msg" i], input[id*="message" i], input[name*="message" i]') as HTMLInputElement | null);

        const sender_name = nameInput?.value.trim() || '';
        const sender_email = emailInput?.value.trim() || '';
        const subject = subjectInput?.value.trim() || 'Portfolio Inquiry';
        const message = messageInput?.value.trim() || '';

        if (sender_name.length < 2) {
          showFormFeedback(form, 'Please enter your name (at least 2 characters).', true);
          nameInput?.focus();
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender_email)) {
          showFormFeedback(form, 'Please enter a valid email address.', true);
          emailInput?.focus();
          return;
        }
        if (message.length < 10) {
          showFormFeedback(form, 'Please enter a message (at least 10 characters).', true);
          messageInput?.focus();
          return;
        }

        const originalLabel = triggerEl?.textContent || '';
        if (triggerEl) {
          triggerEl.textContent = 'Sending...';
          triggerEl.setAttribute('aria-disabled', 'true');
        }
        showFormFeedback(form, 'Sending message...', false);

        try {
          const res = await fetch(`${API_URL}/api/v1/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_name, sender_email, subject, message }),
          });
          const resData = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
          if (!res.ok) throw new Error(resData.error || 'Failed to send message');
          showFormFeedback(form, resData.message || 'Message received! Thank you for reaching out.', false);
          form.reset();
        } catch (err) {
          showFormFeedback(form, err instanceof Error ? err.message : 'Something went wrong', true);
        } finally {
          if (triggerEl && originalLabel) {
            triggerEl.textContent = originalLabel;
            triggerEl.removeAttribute('aria-disabled');
          }
        }
      };

      const onSubmit = (e: SubmitEvent) => {
        const form = e.target as HTMLFormElement | null;
        if (!form || !form.closest('#contact')) return;
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"], button:not([type]), a[href="#send-message"]') as HTMLElement | null;
        void submitInlineContactForm(form, submitBtn);
      };

      const onClick = (e: MouseEvent) => {
        const targetEl = e.target as HTMLElement | null;
        const trigger = targetEl?.closest('a, button') as HTMLElement | null;
        if (!trigger) return;

        const href = trigger.getAttribute('href');
        const inContact = Boolean(trigger.closest('#contact'));
        const parentForm = trigger.closest('form') as HTMLFormElement | null;
        const label = (trigger.textContent || '').toLowerCase();

        if (
          inContact &&
          parentForm &&
          parentForm.querySelector('input, textarea') &&
          (trigger.tagName === 'BUTTON' || !href || href === '#send-message' || href === '#contact' || href === '#')
        ) {
          e.preventDefault();
          void submitInlineContactForm(parentForm, trigger);
          return;
        }

        if (
          href === '#send-message' ||
          (inContact && (href?.startsWith('mailto:') || label.includes('send message') || label.includes('send sms')))
        ) {
          e.preventDefault();
          if (parentForm && parentForm.querySelector('input, textarea')) {
            void submitInlineContactForm(parentForm, trigger);
          } else {
            setContactOpen(true);
          }
          return;
        }

        if (!href || !href.startsWith('#')) return;

        e.preventDefault();
        // Close mobile menu if open (both fallback toggle and pure-CSS checkbox/details)
        if (navContainer?.getAttribute('data-mobile-open') === 'true') {
          navContainer.setAttribute('data-mobile-open', 'false');
          const toggle = navContainer.querySelector('.portfolio-mobile-toggle');
          if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.innerHTML =
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
          }
        }
        const openDetails = trigger.closest('details[open]');
        if (openDetails) openDetails.removeAttribute('open');
        const checkboxToggle =
          aiCheckbox || (navContainer?.querySelector('input[type="checkbox"]') as HTMLInputElement | null);
        if (checkboxToggle && checkboxToggle.checked) {
          checkboxToggle.checked = false;
          drawerTarget?.removeAttribute('data-portfolio-drawer-open');
        }
        const id = href.slice(1);
        const section = id ? doc.getElementById(id) : null;
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          doc.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
      };

      doc.addEventListener('submit', onSubmit);
      doc.addEventListener('click', onClick);
      cleanupDoc = () => {
        doc.removeEventListener('submit', onSubmit);
        doc.removeEventListener('click', onClick);
      };
    };

    // Attach immediately if DOM is interactive/complete (don't wait for external fonts & images)
    const state = iframe.contentDocument?.readyState;
    if (state === 'interactive' || state === 'complete') {
      attach();
    } else {
      iframe.contentDocument?.addEventListener('DOMContentLoaded', attach, { once: true });
    }
    iframe.addEventListener('load', attach);

    return () => {
      iframe.removeEventListener('load', attach);
      cleanupDoc?.();
    };
  }, [hasHtml, epochNumber, skills, brandName]);

  return (
    <>
      {/* Contact Modal */}
      {contactOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{
              backgroundColor: theme?.surface || '#0b0f19',
              color: theme?.ink || '#f1f5f9',
              borderColor: `color-mix(in srgb, ${theme?.ink || '#f1f5f9'} 18%, transparent)`,
            }}
            className="relative w-full max-w-2xl rounded-2xl border p-6 max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <button
              onClick={() => setContactOpen(false)}
              aria-label="Close contact dialog"
              style={{ color: `color-mix(in srgb, ${theme?.ink || '#f1f5f9'} 70%, transparent)` }}
              className="absolute top-4 right-4 hover:opacity-100 opacity-80 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <ContactSection email={email} location={location} theme={theme} />
          </div>
        </div>
      )}

      <ChatWidget enabled={ai.is_enabled} quickPrompts={ai.quick_prompts} theme={theme} />
    </>
  );
}
