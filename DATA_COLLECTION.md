Data collection: what is collected, how and where this data is sent back to Mozilla
-----------------------------------------------------------------------------------

Stats that we collect
=====================

* Number of first party cookies set
* Number of third party cookies set
* Correlation of 1st party domain to 3rd party upon 'cookie set'
* Total counts of each type of cookies set
* A histogram of cookie expiration times

Stats that we want to collect
=============================

* Count read cookies
** per domain, with 1st/3rd correlation?
* Count accepted and rejected cookies
** per domain, etc?
* Collect cookie data only for the top N domains visited
** May need to query places database for 'frecency' for this to work 

Stats that require a closer look at privacy
===========================================

* TBD

Data we will not collect
========================

* Full URL where cookies are set or read
* Any cookie activity during Private Browsing Mode

Options for sending data back
=============================

* TBD

Time Estimates
==============

* Using micropilot alone
** Since we will have to wait for MicroPilot to be fully tested and reviewed for landing on m-c, this may take some time. 2-3 months at best?
* embedding with TestPilot
** TestPilot is unmaintained and disabled as there are some major bugs that will require deep Gecko hacking and testing to figure out. *UNKNOWN time frame*
* Contributing to Collusion
** The next release of Collusion is planned for 2nd quarter of 2013.
** Collusion has a mechanism to send data back to Mozilla.
*** The current data format is documented here: https://github.com/mozilla/collusion/blob/c2_fresh_start/doc/data_format.v1.1.md 
** Collusion has tens of thousands of users, but many more can be conjured up due to the publicity it already has. A marketing effort could provide this.


This Document was last updated on 2013-03-22 
