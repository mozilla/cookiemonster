What is cookiemonster?
======================
Cookiemonster is a Firefox addon that collects usage statistics on cookies.

Why?
====
We want to know:

1. What sites are tracking users. Though many privacy-aware users are concerned about tracking, there is very little data about what the tracking ecosystem looks like. Do a handful of [superconnected organizations][1] collect the majority of cookie data, or is the data collection more evenly distributed? What are the relationships between [tracking sites][2]?

2. How users think about identity. This scope of this question is enormous, but use of login cookies hints at how users think about and manage identity. We can measure how often users clear cookies, how often login cookies are sent on the domain as first party cookies as opposed to 3rd party ones (possibly indicating the presence of a social widget).

3. How cookies are used. There is very little data available on cookie statistics, e.g. what the average lifetime is, how many cookies on average does a site set.

4. What effect Firefox's cookie preferences have on cookie behavior. In Firefox 22 the default cookie behavior may change from allowing all third party cookies to allowing only third party cookies for domains that already have first party cookies set. We should quantify the effects of this change.

[1]: http://www.newscientist.com/article/mg21228354.500-revealed--the-capitalist-network-that-runs-the-world.html
[2]: http://www.evidon.com/trackermap

How are we collecting data?
===========================
We will observe "Set-Cookie" HTTP response headers, and "Cookie" HTTP request headers through the nSIObserver service. We will also observe "cookie-rejected" and "cookie-changed" events (see https://developer.mozilla.org/en-US/docs/Observer_Notifications).

Data that we plan to collect
============================
* Number of first party cookies set and read per domain
* Number of third party cookies set and read per domain
* Number of third party cookies set per pair of first party, third party domains
* Number of cookies accepted and rejected per domain.
* Number of login cookies set and read for popular services (e.g., Google/Twitter/Facebook)
* Total counts of each type of cookies set
* A histogram of cookie expiration times
* Preferences like <pre>network.cookie.behavior</pre> that affect cookies.
* Extensions such as Ghostery or AdBlockPlus that affect cookies.
* Version of Firefox

We will either send cookie events back to Mozilla for aggregation, or aggregate locally on the client, in which case for performance reasons we may have to limit per domain statistics to the top N domains. The top N domains could be estimated with a simple LRU or use frecency statistics from the places database.

Data we will not collect
========================
* Full URL where cookies are set or read. Domains will be limited to eTLD+1.
* Any data during Private Browsing Mode.

Privacy concerns
================
Obviously collecting any information related to domains, including cookies, is a privacy risk. One possible mitigation would be to obfuscate domains with a hash. This allows for aggregation over multiple users but does not allow us to answer the question, what sites are tracking users. It is also a weak defense since we would be unable to salt the data per user, if we aggregate across multiple users.

All the data we propose to collect can be used for fingerprinting, or uniquely identifying a user through browsing or configuration behavior. We should not store this data forever: the time it takes to analyze it plus a short period of time (1 month?) should suffice.

The privacy policy for cookiemonster must be very clear about these risks. In addition we must warn the user on installation and allow the user to vet any data before sending it back.

Options for sending data back
=============================
We have two main options for sending data back to Mozilla: using TestPilot and using micropilot. [TestPilot][4] is an extension that is built-in to mozilla-central. Users who have TestPilot enabled (all Nightly, Aurora and Beta users, along with anyone who has installed TestsPilot from addons.mozilla.org) query a URL every 24 hours to receive TestPilot updates, including any new TestPilot studies. TestPilot knows how to install and uninstall studies, run user surveys, record data and send it back to Mozilla. It has a large UI component.

[Micropilot][3] is the next generation of TestPilot. It is an instrumentation framework built on top of volo that is independent of mozilla-central, and knows how to record events as JSON objects and post them back to Mozilla. In the future, TestPilot will be a shadow of its former self and only know how to install and uninstall addons, including micropilot-enabled addons.

[3]: https://github.com/gregglind/micropilot
[4]: https://testpilot.mozillalabs.com/

Time estimates
==============
* Using micropilot alone
* embedding with TestPilot
    * TestPilot is unmaintained and disabled as there are some major bugs that will require deep Gecko hacking and testing to figure out. *UNKNOWN time frame*
* Contributing to Collusion
    * The next release of Collusion is planned for 2nd quarter of 2013.
    * Collusion has a mechanism to send data back to Mozilla.
    * The current data format is documented here: https://github.com/mozilla/collusion/blob/c2_fresh_start/doc/data_format.v1.1.md 
    * Collusion has tens of thousands of users, but many more can be conjured up due to the publicity it already has. A marketing effort could provide this.


This document was last updated on 2013-03-28
