---
slug: building-your-first-ai-agents
title: Building Your First AI Agents
type: post
status: draft
date: 2026-03-06
author: The Upskilling Labs HQ
summary: Learn the core concepts of agentic development and how to build AI agents that plan, use tools, and execute workflows in this practical guide for builders and problem-solvers.
source_url: https://theupskillinglabs.org/blog/building-ai-agents
---

# Building Your First AI Agents

Recently, over 40 Upskillers gathered at the Microsoft Innovation Hub in Rosslyn, Virginia.

Spearheaded and organized by Afnan Adam , and led by Eric Brown Jr. (Senior AI Solutions Engineer & Innovation Coach at Microsoft), the workshop proved that non-technical professionals can architect their own AI tools when given the right on-ramp. You can read the full recap of the event [here](https://theupskillinglabs.org/newsroom/microsoft-partnership-upskills-40-local-workers-in-ai-agents).

Artificial intelligence is shifting from a tool that answers questions to a system that takes action. In our “Intro to Agentic Workflows” workshop with Eric, we explored what happens when we move beyond standard prompting and start building "agents"—software entities that can plan, remember, use tools, and execute workflows autonomously.

This practical guide is based directly on the foundational concepts from Eric’s workshop. It explores what happens when we move beyond standard prompting and start building "agents"—software entities that can plan, remember, use tools, and execute workflows autonomously. Whether you attended the live session and want to review the core concepts, or you are discovering this material for the first time, this post will help you understand the mechanics of agentic systems and how to apply them to the real-world problems you are trying to solve.

This guide is designed to help you transition from interacting with AI as just a passive conversational partner to designing AI systems that actively work on your behalf.

## Why this matters for Upskillers

As an Upskiller, you are an active builder. You are likely working on a capstone project, a community initiative, a career transition portfolio, or a prototype meant to solve a specific problem.

Standard large language models are incredibly useful for brainstorming and drafting, but they are confined to a chat window. They cannot update your database, check the current weather, send an email, or string together a multi-step research process without your constant hand-holding.

Agentic development bridges the gap between thinking and doing. By learning how to build agents, you gain the ability to create prototypes that interact with the outside world. This is not just a technical skill—it is a new way to design workflows, automate repetitive tasks, and build more robust, interactive projects that provide genuine value to your team and your community.

## Core concepts

To build an agent, you have to understand how it differs from a traditional program and a standard chatbot. We can break agentic development down into a few foundational pillars.

### The definition of an agent

In traditional software development, you write explicit, step-by-step instructions for the computer to follow. In standard AI interactions, you provide a prompt and get a static response. An "agent" sits between these two paradigms. It is an AI system driven by a large language model that has been given a goal, a set of tools, and the autonomy to decide which steps to take to achieve that goal.

### The engine: Reasoning and planning

The brain of an agent is the language model, but instead of just generating text, the model is instructed to reason about a problem. A common framework for this is "ReAct" (Reasoning and Acting). When given a task, the agent first thinks about what it needs to do, decides on an action, observes the result of that action, and then thinks about the next step. This loop continues until the overarching goal is met.

### Tools and actions

An agent without tools is just a philosopher—it can think, but it cannot do. Tools are the specific functions you give to your agent to interact with the world. A tool might be a web search API, a calculator, a script that queries a local database, or an integration that sends a message to Slack. You define what the tool does and exactly how the agent should use it. The language model then decides when to use it based on the problem it is trying to solve.

### Memory and context

For an agent to act intelligently over time, it needs memory. Short-term memory allows the agent to remember the steps it has taken within a single task so it does not repeat itself or get stuck in a loop. Long-term memory involves storing information (often in a database) that the agent can recall days or weeks later. Designing an agent requires making deliberate choices about what information is worth keeping and how the agent will retrieve it when needed.

### The spectrum of autonomy

Agency is not binary. You do not have to choose between a completely manual process and a fully autonomous robot. Most practical agentic development happens on a spectrum. You might build a "copilot" that drafts a plan and asks for your approval before executing it. Keeping a human in the loop is often the most responsible and effective way to design an agent, especially when the stakes are high.

## How to apply this in a project

Understanding the theory of agents is only useful if you can map it to your own work. When you are ready to introduce agentic features into your capstone, pod project, or personal prototype, follow these practical steps.

### Start with a narrow, defined problem

Do not set out to build an agent that can "manage your entire project." Start with a highly specific, tedious workflow. For example, if your community project requires gathering public city council agendas, reading them for specific zoning terms, and logging the results in a spreadsheet, that is a perfect candidate for an agent. The scope is narrow, the success criteria are obvious, and the value is immediate.

### Draft the manual workflow first

Before writing any code or configuring an agent framework, map out exactly how a human would solve the problem. What information do they need at the start? What tools do they use? What decisions do they make at each crossroads? This manual map becomes the exact logic you will use to define your agent's reasoning prompts and toolset.

### Equip one tool at a time

It is tempting to connect your agent to every API available. Resist this urge. Give your agent a single tool—for instance, the ability to read a web page. Test the agent repeatedly to ensure it knows how to use that tool reliably. Only once it succeeds consistently should you introduce a second tool.

### Design for failure

Agents are unpredictable. They will occasionally misuse a tool, misunderstand a result, or get trapped in an infinite loop of faulty reasoning. In your project, you must build in fail-safes. Set hard limits on how many steps the agent can take before it stops and asks a human for help.

## Practical prompts and exercises

To move these concepts from theory to practice, spend fifteen minutes on the following exercises. You can do these individually or discuss them with your pod.

The Workflow Audit Look at the project you are currently working on. Identify one repetitive task that requires a mix of searching for information, summarizing it, and moving it from one place to another. Write down the exact steps you take to do this task.

The Tool Definition Exercise If you were to hand the workflow from the previous exercise over to an AI agent, what specific tools would it need? Write a short, plain-English description of three tools. For example: "Tool 1: A search function that looks up public employee salaries. Tool 2: A calculator to find the median salary. Tool 3: A writer that adds the finding to a new row in Airtable."

The Human-in-the-Loop Checkpoint Review your proposed agent workflow. Where is the risk highest? Identify the exact moment where the agent should pause and ask a human for approval before proceeding. Draft the message the agent would send to the user at that exact moment.

## Common mistakes or misunderstandings

When Upskillers first begin building agents, a few common traps tend to slow down their progress.

The most frequent mistake is assuming the language model is infallible. Because agents operate autonomously, a small hallucination early in the reasoning process can cascade into a massive error by the end. This is why giving an agent too much autonomy too quickly is dangerous.

Another common misunderstanding is overcomplicating the toolset. Developers often build complex, multi-functional tools for their agents. Agents perform much better with simple, single-purpose tools. Instead of one tool that "researches and writes a report," build one tool that "fetches a document" and another that "summarizes text."

Finally, people often forget the user experience. An agent working silently in the background can feel broken to the end user. Good agentic development requires building transparency into the system so the user can see what the agent is currently thinking, what tool it is using, and why it is taking a specific action.

## Key takeaways

Agentic development is a powerful evolution in how we build software, moving AI from a conversational interface to an active participant in our workflows.

Remember that building an agent is an exercise in constraint. The best agents are built to solve narrow problems, equipped with simple tools, and designed with clear boundaries. By applying the principles of reasoning, memory, and tool use, you can build systems that don't just talk about solutions, but actively help you construct them. Start small, map your logic carefully, and always keep a human in the loop as you experiment.
