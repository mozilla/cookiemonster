import bisect
import random

class CappedOrderedList(object):
    def __init__(self,n):
        self.n = n
        self.list = []
    
    def clear(self,n):
        self.list=[]

class CappedOrderedMinList(CappedOrderedList):
    def add(self,val):
        l = self.list
        if len(l) >= self.n and val > l[-1]:  return

        position = bisect.bisect(l, val)
        bisect.insort(l, val)
        if len(l) >= self.n:  
            self.list = l[:self.n]

class CappedOrderedMaxList(CappedOrderedList):
    def add(self,val):
        l = self.list
        if len(l) >= self.n and val < l[0]:  return

        position = bisect.bisect(l, val)
        bisect.insort(l, val)
        if len(l) >= self.n:  
            self.list = l[-self.n:]

class StreamSampler(object):
    def __init__(self,n,nmin=50,nmax=50):
        self.list = [0]*n
        self.n = n
        self.nmax = nmax
        self.nmin = nmin
        self.mins = CappedOrderedMinList(self.nmin)
        self.maxes = CappedOrderedMaxList(self.nmax)

    def sample(self,thing,ii):
        """ 
        args:
            thing: thing to add
            ii:    int, relating to probability
        """
        self.mins.add(thing)
        self.maxes.add(thing)
        if ii < self.n:
            self.list[ii] = thing
        else:
            ii = random.randint(0,ii)
            if ii < self.n:
                self.list[ii] = thing
