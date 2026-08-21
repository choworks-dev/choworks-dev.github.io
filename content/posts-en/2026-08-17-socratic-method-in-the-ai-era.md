---
title: The Socratic Method, 2400 Years Later
date: 2026-08-17
description: The most effective way to learn anything was invented in Athens. The catch was that there was only one Socrates. That constraint is gone now.
tags: [AI learning, Socratic method, Claude, prompting, solo business]
---

{{svg: hero-socratic-method-in-the-ai-era-en}}

The way I learn things now has almost nothing in common with the way I was taught in school. I don't sit through courses. I don't read books front to back. I just keep asking. At some point I realized this isn't a new method. It's the one they used in Athens 2400 years ago.

## Socrates never taught anything

Socrates gave no lectures and wrote no books. All he did was corner people and ask them questions.

The pattern runs like this. Someone claims to know what courage is, so Socrates asks them to define it. A definition arrives. He doesn't argue with it. He asks about one case where it doesn't hold. They revise, and he asks about a case that breaks the revision. A few rounds of this and the person arrives at realizing they never knew the thing at all. The Greeks called that dead end aporia.

Only someone who knows they don't know starts asking in earnest. Socrates called his own role midwifery: not putting knowledge into people, but delivering what was already in them. In Plato's Meno, a boy who has never studied geometry gets nothing but questions and works out how to double the area of a square on his own. Socrates never told him anything.

## Why it worked

Conclusions handed to you don't stick. Conclusions you narrowed your way into do. The reasons are not mysterious.

First, having to produce a definition in your own words exposes exactly how far your understanding goes. A lecture never exposes this, because there is no way to tell the feeling of understanding apart from understanding.

Second, counterexamples draw the boundary. Knowledge is not a sentence, it's a boundary. Knowing where a rule applies and where it breaks is what knowing means.

Third, someone who has hit a dead end does not forget the answer that follows. They needed it.

## The catch was that there was only one Socrates

The method had a fatal constraint. The person answering had to be sitting in front of you.

So conditions applied. You had to live in Athens, have time to spend in the agora, and catch Socrates in a decent mood. Step outside what he knew and the conversation stopped there. Ask the same question three times and the other person gets tired. Above all, saying "I don't know" to another human being has a price. Which is why, historically, this way of learning was always a privilege of a tiny few. It belonged to whoever could stand next to a teacher.

## The constraint is gone

I now run the Socratic method with Claude, and not one of those limits survives.

No time limit. I can ask at three in the morning. No repetition limit. I can ask the same thing five different ways and nothing on the other end gets tired. No loss of face, so I can ask about what I actually don't know. That one matters more than it sounds. When we ask a person, we smuggle a bit of pretend competence into the question, and the answer comes back calibrated to the pretense. No subject boundary either. I can ask about DNS, then taxes, then a clause in a contract, without the conversation breaking.

The result is that the time between not knowing and knowing collapsed. What took months takes days, what took days takes half an hour. Saying the ceiling on how much I can learn has been removed is not an exaggeration.

## This is how it actually went

Take [the website I finally moved after years of neglect](/en/posts/wix-to-cloudflare/). I did not know DNS. I did not know the difference between an A record and a CNAME.

I didn't go find a course. I asked, in this order:

- Where is this domain currently pointing
- What is the difference between an A record and a CNAME, and why do both exist
- People say you can't put a CNAME on an apex domain. Why not
- So www is a CNAME and the apex is an A record. Have I understood that correctly
- Turning the proxy on supposedly breaks certificate issuance. What exactly is breaking what
- If I set a wrong value from where I am right now, how long is my site down

That last question matters. It isn't a question about knowledge, it's a question about the risk I'm about to carry. For someone doing the actual work, that's the more useful kind.

An hour of this does not make me a DNS expert. But the domain is moved, and next time something similar happens I know where to look. [The quote automation](/en/posts/google-apps-script-quote-automation/) and [moving it onto n8n](/en/posts/google-apps-script-to-n8n/) both went the same way.

## Asking once is not a dialogue

This is where people split. Most ask an AI one question, take the answer, and close the tab. That is search with better manners. The Socratic part starts after the answer arrives.

You question the answer. Why is that so. Then what happens in this case. Does that hold for my situation. You said A just now, but earlier you said B.

And one more thing. **Restate what you understood in your own words and ask whether you've got it right.** That is the same seat as offering a definition to Socrates. It's where the feeling of understanding separates from understanding. Of everything I picked up, I think that single habit did the most.

Ask what you don't know, and when the answer comes, ask again. Do that and eventually you know. That is how learning works now.

## The download needs intent

I wrote earlier about [the scene in The Matrix where flying a helicopter downloads into Neo's head](/en/posts/ai-transformation-starts-with-me/). Watch it again and one detail stands out. Before the download starts, Neo has an urgent reason to get off that roof. The skill arrives attached to a purpose.

Moving what an AI knows into my own head and hands works the same way. You cannot produce a good question out of no purpose at all. What you want to build, which problem you want gone this week, who you're trying to become. Something has to be settled before a question can form. Without that intent, what comes out isn't a question, it's a search term. And search terms don't come back with answers attached.

The answer isn't inside the AI. **It's inside the question your intent shaped.** The AI only responds to it. A blurry question gets a blurry response. This isn't a tip about writing better prompts. It's about knowing what you're trying to do.

Socrates now sits beside you around the clock. He never gets tired and never asks how you could possibly not know that. One thing is left. Deciding what you want to know.

The excuse that there's nobody to ask is gone.
