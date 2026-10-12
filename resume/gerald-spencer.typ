// Resume using basic-resume package
// Compile: bazel build //:resume

#import "@preview/basic-resume:0.2.9": *

#set page(margin: (x: 0.65in, y: 0.5in))
#set par(leading: 0.55em)

#show: resume.with(
  author: "Gerald Spencer",
  accent-color: "#334155",
  font: sys.inputs.at("font", default: "Helvetica Neue"),
  paper: "us-letter",
)

#v(-0.3em)
#text(size: 10pt)[408-623-9465 | New York, NY | #link("mailto:contact@geraldhspencer.com")[contact\@geraldhspencer.com] | #link("https://www.linkedin.com/in/geraldspencer/")[linkedin.com/in/geraldspencer] | #link("https://geraldhspencer.com")[geraldhspencer.com]]
#v(0.2em)

Principal Software Engineer and technical leader working on NVIDIA's internal cloud for silicon engineering. Earlier work includes large-scale GPU infrastructure for AI research, fleet lifecycle automation, and developer platforms. 12+ years designing and operating mission-critical infrastructure.

== Experience

#work(
  company: "NVIDIA",
  title: "Principal Software Engineer",
  dates: dates-helper(start-date: "2023", end-date: "Present"),
  location: "Santa Clara, CA",
)
- Lead scheduling and fleet lifecycle work for NVIDIA's internal cloud for silicon engineering, focusing on capacity allocation, repeatable deployments, and safe changes across the global compute fleet.
- Founded and scaled an infrastructure organization from 2 to 100 engineers over 2 years, spanning platform and bare-metal automation and enabling 95%+ training goodput for large-scale AI research.
- Built a fleet remediation platform that triaged and resolved failures through 150K+ concurrent workflows across 50K+ GPUs, and standardized fleet operations across cloud providers.
- Delivered a 99.99% SLA CI/CD platform supporting 500+ engineers, including large-scale Bazel Remote Build Execution (RBE) infrastructure.

#work(
  company: "Cruise",
  title: "Staff Software Engineer",
  dates: dates-helper(start-date: "2022", end-date: "2023"),
  location: "San Francisco, CA",
)
- Architected an automated release attestation platform for a 6-person team, introducing policy-driven validation gates that reduced deployment cycle time by 40% while improving release safety.
- Designed a deployment governance framework enforcing rollout policies across the autonomous vehicle fleet, materially reducing production incidents and improving operational reliability.
- Built unified UI/CLI tooling to standardize release management workflows, enabling consistent, auditable deployments for 200+ engineers.

#work(
  company: "Skydio",
  title: "Staff Software Engineer",
  dates: dates-helper(start-date: "2019", end-date: "2022"),
  location: "San Mateo, CA",
)
- Led a company-wide infrastructure overhaul, achieving SOC 2 Type I certification within three quarters and establishing foundational security and compliance practices.
- Architected a high-scale CI platform supporting 15K builds/day across 2,500 ephemeral workers, using custom scheduling algorithms to optimize utilization and throughput.
- Migrated deployment infrastructure to Kubernetes, reducing release time from 2 hours to 15 minutes and enabling faster, more reliable production rollouts.

#work(
  company: "3Scan (now Strateos)",
  title: "Director of Infrastructure",
  dates: dates-helper(start-date: "2012", end-date: "2019"),
  location: "San Francisco, CA",
)
- Scaled infrastructure from 1 to 4 facilities, accelerating build throughput 13×.
- Architected multi-petabyte medical imaging platform: 24GB/s ingestion, 3.8PB storage capacity.
- Architected and operated custom high-throughput network infrastructure, establishing direct BGP peering with AWS over 40 Gbps fiber to enable petabyte-scale data transfer.

== Education

#edu(
  institution: "California Maritime Academy",
  degree: "B.S. Mechanical Engineering with USCG 3rd Assistant Engineer License",
  dates: dates-helper(start-date: "2010", end-date: "2014"),
  gpa: "3.8",
)

== Volunteer Leadership

#extracurriculars(
  activity: "Flux Foundation",
  dates: "2012-2023",
)
- Board member for non-profit supporting large-scale art; lighting design lead for multiple temples and installations—network architecture, custom control software, and technical implementation.
