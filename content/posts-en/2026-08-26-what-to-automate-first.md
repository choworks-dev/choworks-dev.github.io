---
title: What a Solo Business Should Automate First
date: 2026-08-26
description: A month of actually removing work, in the order it happened. There is a way to decide what to touch first, and starting wrong wastes the momentum.
tags: [AI automation, AI transformation, solo business, workflow automation, Claude]
draft: true
---

{{svg: hero-what-to-automate-first-en}}

When people asked what they should automate with AI, I used to have no answer. I did not know either. After a month of doing it, an order has emerged. Here is what I actually removed, in the order I removed it.

## How to choose

What matters more than what to automate is **what to touch first.** I filtered on three things.

**One. Is there a correct answer?** Work with exactly one right answer gets answered when you ask. Moving a website is like that. "What should my company say about itself" has no correct answer, so no amount of asking helps. I have to decide that.

**Two. How much does being wrong hurt?** Start where a mistake just means doing it again. Payments and personal data, where being wrong shakes the business, come later. I have not touched those.

**Three. Does it come back every month?** One-off work leaves nothing behind when automated. It has to recur to be worth building.

Start with whatever passes all three.

## 1. Cut a recurring cost

The first thing I did was [move two long-neglected websites](/en/posts/wix-to-cloudflare/). About $400 a year went to zero.

There was a reason to start there. **The result shows up as a number immediately.** You see it on next month's card statement. Especially at the beginning, you need a visible result or you will not do the next thing.

It also passes all three filters. Correct answer exists, mistakes are recoverable, and the money went out every month.

## 2. Turn a full day into five minutes

Next was [sending quotes](/en/posts/google-apps-script-quote-automation/). A request arrives, I check the exchange rate, apply per-product discounts, build the document, export a PDF, send the email. A full day.

It became five minutes. Not by buying software, but by using **a feature inside the Google Workspace subscription I was already paying for.** For years I had used it as an inbox and nothing else.

**I suspect this is the most common situation.** An unused capability sitting inside a tool you already pay for.

## 3. Make what you built openable by someone else

The third one is different. Nothing new was automated. I [rebuilt something that already worked](/en/posts/google-apps-script-to-n8n/).

It worked fine, but nobody except the person who wrote it could open it. Changing a notification time meant opening code.

**In a small company that is a real problem.** An automation tied to one person stops when that person is busy and cannot be fixed when that person is gone. So now I hold two questions side by side: does it run, and **does it run without me.**

## 4. Catch the ones that stop quietly

After a few automations, a new worry appeared. **Not knowing when one stops.**

Work a person does gets noticed when it stops. Work handed to a machine does not. A job of mine [meant to run every ten minutes ran seventeen times in a day](/en/posts/github-actions-cron-delay/) and the dashboard was green the entire time.

So now, when I build an automation, I build the check with it. And it notifies me **when things go right too.** An alert that only arrives on failure cannot tell you the difference between nothing being wrong and the alerting itself being broken.

## 5. Put the numbers where you will look

Most recent. I made visitor and search data show up in **my own admin screen** instead of somebody else's dashboard.

The collecting still happens outside. A static site has no server, so there is nowhere of mine to record a visit. That part cannot change. But **having to go somewhere to look** can. A job pulls the data once a day and writes it to a file, and my screen reads the file.

If checking the numbers is a chore you stop checking, and if you stop checking you cannot fix anything.

## The order again

```
1  A cost that goes out monthly        the result is a visible number
2  Unused features in tools you own    nothing new to buy
3  Make it openable by others          do not tie it to yourself
4  Catch silent failures               required once you have a few
5  Put numbers where you look          inconvenient means unread
```

## What I have not done

Payments and personal data are untouched. So is anything where being wrong means money is wrong, like bookings or inventory. **Not because I cannot, but because I am not willing to own the failure.**

I also do not ask AI what my company sells. Ask and you get a plausible sentence, but it is not about my company.

## If you only pick one

**Pick the first one.** Look for something that leaves every month and is not being used. Website hosting, a forgotten subscription, a service you attached years ago. Reading one card statement top to bottom is a fine way to start.

Cutting one is enough to make you do the next one. That is how I started.
