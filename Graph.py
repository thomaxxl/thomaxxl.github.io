import sys, os
import MySQLdb as mdb
import json
import logging
import cPickle as pickle

DBHOST = 'localhost'
DBUSER = 'root'
DBPASS = 'fucksecurity'
DB     = 'stacktrack'

con = mdb.connect(DBHOST,DBUSER,DBPASS,DB)
logging.basicConfig()
log = logging.getLogger()
log.setLevel(logging.DEBUG)

class Graph():

    def __init__(self):

        self.loaded = set()
        self.nodes  = {}
    
    def add_node(self,node):
        '''
           Can be instantiated from 
           - string (node name)
           - Node type 
           - (json) dict

           There can only be one node with the same name. If the name 
           already exists in _instances, the corresponding node value
           is returned
        '''

        callees     = set()
        callers     = set()
        sourcefile  = ''

        if type(node) == Node:
            name = node.name

        elif type(node) in (str,unicode):
            name = node

        else: #todo: error checking ... 
            log.critical('Unknown type "{}"'.format(type(node)))

        if name not in self.nodes:

            log.debug('Creating Node {} {}'.format(name,len(self.nodes)))
            node =  Node(name, sourcefile, callees, callers )
            self.nodes[name] =  node

        return self.nodes[name]

    def add_edge(self, caller, callee):
        caller_node = self.add_node(caller)
        callee_node = self.add_node(callee)
        caller_node.add_callee(callee_node)
        callee_node.add_caller(caller_node)
        return caller_node, callee_node

    def load(self, direction = ["callee"]):
        
        for node in self.nodes.values():
            neigbours = self.load_node(node, direction)

    def load_node(self, node, direction = ["callee"] ):
        
        if node in self.loaded:
            return

        log.debug('Loading {}'.format(node))
        self.loaded.add(node)

        neighbours = set()
        cursor  = con.cursor(mdb.cursors.DictCursor)

        query = ''' SELECT caller, callee
                    FROM xrefs
                    WHERE 
                        caller COLLATE latin1_general_cs LIKE %s 
                        OR 
                        callee COLLATE latin1_general_cs LIKE %s
                '''

        cursor.execute(query,(node.name,node.name))
        #log.debug(cursor._executed)
        rows = cursor.fetchall()
        for row in rows:
            callee_name     = row['callee']
            caller_name     = row['caller']
            caller, callee  = self.add_edge(caller_name,callee_name)
            if node == caller and "callee" in direction:
                self.load_node(callee)
                neighbours.add(callee)
            elif "caller" in direction:
                neighbours.add(caller)
                pass
                #self.load_node(caller)

        return neighbours
 
    def get_nodes(self):

        return self.nodes

    def dump_nodes(self, destdir = '/mnt/u/json'):
        
        for node in self.nodes.values():
            self.dump_node(node,destdir)
    
    def dump_node(self,node,destdir):
        outfile = os.path.join(destdir,node.name + '.json' )
        log.debug('dumping {} to {}'.format(node,outfile))
        if node.get_callers() or not node.get_callees():
            log.debug('Ignoring {}'.format(node))
            return
        with open(outfile, 'w+') as f:
            f.write(json.dumps(node,cls=NodeEncoder,indent=True,check_circular=False))



class Node(object):

    def __init__(self, name, sourcefile, callees, callers ):

        self.name       = name
        self.loaded     = False
        self.callers    = callers
        self.callees    = callees
        self.sourcefile = sourcefile

    def __hash__(self):
        return hash(self.name)

    def __repr__(self):
        return 'Node {0}'.format(self.name)

    def __str__(self):
        return self.__repr__()

    def add_caller(self,node):
        self.callers.add(node)

    def add_callee(self,node):
        self.callees.add(node)

    def get_callers(self):
        return self.callers

    def get_callees(self):
        return self.callees
           

class NodeEncoder(json.JSONEncoder):
    '''
        Encodes nodes, the processed variable is used 
        to avoid circular references
    '''
    def __new__(cls,*args,**kwargs):

        instance = super(NodeEncoder,cls).__new__(cls,*args,**kwargs)
        instance.processed = set()
        return instance

    def default(self,object):

        if isinstance(object,Node):
            return self.encode_node(object)


    def encode_node(self,node):
        '''
            encode a node as a d3 json object
        '''
            
        log.debug('Encoding {}'.format(node.name))
        if node in self.processed :
            
            log.debug("Already Processed {}".format(node.name))
            result ={ "name"     : node.name,
                      "label"    : node.name,
                      "type"     : "duplicate",
                   }

        else:
            self.processed.add(node)
            children = []
            for child in getattr(node,'callees'):
                children.append(child)

            result = {  "name"      : node.name, 
                        "label"     : node.name,
                        "size"      : 1 ,
                        "sourcefile": node.sourcefile,
                        "type"      : "original",
                        "children"  : children
                     }

        return result


def main():
    nodenames = sys.argv[1:]
    g = Graph()
    for noden in nodenames:
        node = g.add_node(noden)
    g.load()
    #g.dump_node(nodenames[0],'/tmp/json')
    g.dump_nodes('/var/u/json')
    exit()


if __name__ == '__main__':
    main()
