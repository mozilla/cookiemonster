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
* Preferences like network.cookie.behavior that affect cookies.
* Extensions such as Ghostery or AdBlockPlus that affect cookies.
* Version of Firefox

We will either send cookie events back to Mozilla for aggregation, or aggregate locally on the client, in which case for performance reasons we may have to limit per domain statistics to the top N domains. The top N domains could be estimated with a simple LRU or use frecency statistics from the places database.

Data we will not collect
========================
* Full URL where cookies are set or read. Domains will be limited to eTLD+1.
* Any data during Private Browsing Mode.

Proposed data format
====================
We consider two formats, one event-based (aggregation happens on the server side) and one where some aggregation happens at the client.

Micropilot uploads a bunch of metadata (FF version, extensions, userid) along with a events array every time the upload function is called. In the events array, we store:
<pre>
  event: {
    // One of "cookie-event", "cookie-service-event", "social-event", "pref", or "metadata"
    name: string,
    // One of the event objects listed below. Each object has its own timestamp.
    obj: [ Object ]
  }
</pre>

The "metadata" event records information about the upload itself that we want in addition to the Micropilot metadata:
<pre>
metadata: {
  // We want to be able to correlate events belonging to the same user across the length of the study. This is because
  // we are more interested in questions like how many users deleted all their cookies this week, as opposed to how 
  // many times did all cookies get deleted this week. Micropilot actually records this for us.
  personid: string,
  // Time range in seconds since epoch that this JSON object represents
  begin_time: uint_64,
  end_time: uint_64,
  // Version of data format. This number must change when any of the event formats change.
  version: int
}
</pre>

The "cookie-event" and "cookie-service-event" objects record get and set cookie events, along with accept and reject events according to the cookie manager.

<pre>
  // These correspond to Set-Cookie and Cookie HTTP headers, as observed by http-on-examine-response and http-on-modify
  cookie_event: {
    // Timestamps are useful to correlate with actions
    timestamp: uint_64,
    // Get or set?
    mode: int,
    // How many cookies were read or set in this request?
    count: int,
    // If we have any logic to detect login or tracking cookies, we should store the results as an enum here. The length 
    // should be the same as the count field.
    types: { type: int },
    // For Set-Cookie events, the lifetime in seconds of the cookies that are set. The length of this field is the same 
    // as the count field.
    expirations: { type: int },
    // eTLD + 1, no URL params
    domain: string,
    // If this is a third-party cookie, the first-party domain
    referrer: string
  },
  // These correspond to cookie accept and reject events, as observed from nsICookieService. If we can also figure out 
  // when cookies are cleared, we can capture that in this stanza as well.
  cookie_service_events: {
    timestamp: uint_64,
    // An enum for accept or reject
    type: int
  }
  // Every time a user clicks a social widget, we add one of these
  social_events: {
    // Timestamps are useful to correlate with other events. Can we tie this to a cookie event?
    timestamp: uint_64,
    // Network, e.g. Facebook Like, Twitter RT, Google+ +1
    network: string
  }
  // These are filled in when the object is packaged up for sending
  prefs: {
    // When did we read these prefs?
    timestamp: uint_64,
    // e.g., network.cookie.behavior
    name: string,
    // Not every pref value is a string, but all can be represented as strings
    value: string
  }
}
</pre>

Here is an example JSON blob if we do some aggregation locally.
<pre>
daily_dump: {
  // The user id, so we can correlate across days
  user_id: string,
  // The time range represented by this object
  begin_timestamp: uint_64,
  end_timestamp: uint_64,
  cookie_events: {
    // Set or read?
    mode: int,
    // How many?
    count: int
    // The cookie domain
    domain: string;
    // The referring domain (different if third party)
    referrer: string,
  },
  cookie_lifetimes: {
    // Pick some likely buckets, e.g. 1 day, 1 month, 1 year
    bucket_index: int,
    // How many cookies belonged to this bucket?
    count: int
    // Do we care what kind of cookies they are (first vs. third?) If so, it will be difficult to slice this data.
  },
  social_events: {
    // Clicks on social widgets
    network: string,
    count: int
  }
  prefs: {
    // Same as above
  }
  extensions: {
    // Same as above
  }
}
</pre>

Obviously, aggregating on the client side is more compact, but less resilient to error if we make a mistake, e.g. choosing the right bucket sizes for cookie lifetimes. However, we still need to aggregate on the server no matter which format we choose.

Server requirements
===================
The server must be able to process JSON HTTP POST requests over SSL. We will most likely write data analysis scripts in node.js since all event objects are JSON.

Data storage requirements
=========================
All data will be stored at Mozilla. Any data with user ids must not be released publicly, and must not be stored indefinitely. Aggregated data such as global distribution of cookie domains by volume, can and should live forever.

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
* Using micropilot alone (4 weeks)
* embedding with TestPilot (indefinite)
    * TestPilot is unmaintained and disabled as there are some major bugs that will require deep Gecko hacking and testing to figure out.
* Contributing to Collusion (months)
    * The next release of Collusion is planned for 2nd quarter of 2013.
    * Collusion has a mechanism to send data back to Mozilla.
    * The current data format is documented here: https://github.com/mozilla/collusion/blob/c2_fresh_start/doc/data_format.v1.1.md 
    * Collusion has tens of thousands of users, but many more can be conjured up due to the publicity it already has. A marketing effort could provide this.
