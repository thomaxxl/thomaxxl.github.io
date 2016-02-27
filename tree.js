
///////// Spinner 

var opts = {
  lines: 13, // The number of lines to draw
  length: 7, // The length of each line
  width: 4, // The line thickness
  radius: 10, // The radius of the inner circle
  rotate: 0, // The rotation offset
  color: 'steelblue', // #rgb or #rrggbb
  speed: 1, // Rounds per second
  trail: 60, // Afterglow percentage
  shadow: false, // Whether to render a shadow
  hwaccel: false, // Whether to use hardware acceleration
  className: 'spinner', // The CSS class to assign to the spinner
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  top: 'auto', // Top position relative to parent in px
  left: 'auto' // Left position relative to parent in px
};
var spinner = new Spinner(opts).spin();
$("#loading").append(spinner.el);

///////// End Spinner


var depth = 1;
var node_depth = 100;
var node_height = 20;

var m = [20, 120, 20, 120],
    w = 80000 - m[1] - m[3],
    h = 80000 - m[0] - m[2],
    i = 0;

var tree; // = d3.layout.tree() .size([h, w]);

var diagonal = d3.svg.diagonal()
    .projection(function(d) {
        return [d.y, d.x];
    });

var vis = d3.select("#tree").append("svg:svg")
    .attr("width", w + m[1] + m[3])
    .attr("height", h + m[0] + m[2])
    .attr("id", "treesvg")
    .style("overflow", "auto")
    .append("svg:g")
    .attr("transform", "translate(" + m[3] + "," + m[0] + ")");


var gdict = [];

// nodenames to be excluded
var omit_list = ['__fentry__', '#','__stack_chk_fail'];

function omit(node) {
    omit_list.forEach(function(f) {
        if (node.children) {
            filtered = [];
            node.children.forEach(function(c) {
                if (c.label != f) {
                    filtered.push(c);
                }
            });
            node.children = filtered;
        }
    });
    if (node.children == []) {
        node.children = null;
    }
    return node;
}

function node_to_dict(node) {
    node = omit(node);
    children = node.children ? node.children : []; 

    children.forEach(function(child) {
        if (child.type == "original") {
            node_to_dict(child);
        }
    });
    copy = JSON.parse(JSON.stringify(node));
    copy._children = copy.children;
    copy.children = null;
    gdict[node.name] = copy;
}


function init() {

    $("#loading").show();
    depth = $("input[name='depth']").val();
    depth = parseInt(depth) - 1;
    tree = d3.layout.tree();//
    var json_f = getParameterByName('json') ? getParameterByName('json') : 'sys_chdir.json' ;
    d3.json(json_f, function(error, tree) {

        root = tree;
        // root initialized above with the html
        root.x0 = h / 2;
        root.y0 = 0;

        function toggleAll(d) {
            if (d.children && d.children != []) {
                d.children.forEach(toggleAll);
                toggle(d);
            } else {
                delete d['children'];
                delete d['_children'];
            }
        }

        node_to_dict(root);
        // hide all nodes
        root.children.forEach(toggleAll);
        update(root);
        toggle_to(root,depth);
        goto_node(root);
    });
}

function toggle_to(node,depth){
    if (depth <= 0 ){ // || node.type != "original"){
        return;
    }
    children = node.children ? node.children : node._children;
    if ( ! children ){
        return;
    }
    children.forEach(function(c){
        toggle(c);
        update(c);
        toggle_to(c,depth - 1);
    });
}

function goto_node(node){
    w = window.innerWidth ;
    h = window.innerHeight / 2;
    window.scrollTo(node.y , node.x - h);
}

function resize(direction, pm) {
    size = tree.size();
    if (direction == 'x') {
        node_height += pm == '+' ? 2 : -2;
    }
    if (direction == 'y') {
        node_depth += pm == '+' ? 20 : -20
    }
    update(tree);
    goto_node(root);
}


function update(source) {

    function has_children(node) {
        original = gdict[node.label];
        if (original && original._children && original._children.length > 0) {
            return true;
        }
        return false;
    }

    function is_collapsed(node){
        if ( ! has_children(node) ){
            return false;
        }
        original = gdict[node.label];
        return original.children ? false : true ;
    }
            

    function node_color(node) {
        if (node.type == "duplicate" || node.type == "copy") {
            if (node.children){
                return "white";
            }
            if (is_collapsed(node)) {
                return "lightsteelblue";
            } else {
                return "#F88080";
            }
        }
        if (node._children && has_children(node) ) {
            return "lightsteelblue";
        }
        return "white";
    }

    var duration = d3.event && d3.event.altKey ? 5000 : 500;

    // compute the new height
    var levelWidth = [1];
    var childCount = function(level, n) {

        if (n.children && n.children.length > 0) {
            if (levelWidth.length <= level + 1) levelWidth.push(0);

            if (level > depth) {
                depth = level;
            }
            levelWidth[level + 1] += n.children.length + level * 1.5;
            n.children.forEach(function(d) {
                childCount(level + 1, d);
            });
        }
    };
    childCount(0, root);

    // Compute the new tree layout.
    var newHeight = d3.max(levelWidth) * node_height; // 20 pixels per line

    if(! tree.cust_size){
        tree = tree.size([newHeight, depth * 10]);
    }

    var nodes = tree.nodes(root).reverse();

    if(! tree.cust_size){
        nodes.forEach(function(d) {
            d.y = d.depth * node_depth;
        });
    }

    tree.cust_size = false;

    // Update the nodes.
    var node = vis.selectAll("g.node")
        .data(nodes, function(d) {
            return d.id || (d.id = ++i);
        });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("svg:g")
        .attr("class", "node")
        .attr("transform", function(d) {
            return "translate(" + source.y0 + "," + source.x0 + ")";
        })
        .on("click", function(d) {
            toggle(d);
            update(d);
            //console.log(d);
            //goto_node(d);
        });

    nodeEnter.append("svg:circle")
        .attr("r", 1e-6)
        .style("fill", node_color);

    nodeEnter.append("svg:text")
        .attr("x", function(d) {
            return has_children(d) ? -10 : 10;
        })
        .attr("dy", ".35em")
        .attr("text-anchor", function(d) {
            return has_children(d) ? "end" : "start";
        })
        .text(function(d) {
            return d.label;
        })
        .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    var nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", function(d) {
            return "translate(" + d.y + "," + d.x + ")";
        });

    nodeUpdate.select("circle")
        .attr("r", 4.5)
        .style("fill", node_color);

    nodeUpdate.select("text")
        .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    var nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", function(d) {
            return "translate(" + source.y + "," + source.x + ")";
        })
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);

    // Update the links.
    var link = vis.selectAll("path.link")
        .data(tree.links(nodes), function(d) {
            return d.target.id;
        });

    // Enter any new links at the parent's previous position.
    link.enter().insert("svg:path", "g")
        .attr("class", "link")
        .attr("d", function(d) {
            var o = {
                x: source.x0,
                y: source.y0
            };
            return diagonal({
                source: o,
                target: o
            });
        })
        .transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition links to their new position.
    link.transition()
        .duration(duration)
        .attr("d", diagonal);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(duration)
        .attr("d", function(d) {
            var o = {
                x: source.x,
                y: source.y
            };
            return diagonal({
                source: o,
                target: o
            });
        })
        .remove();

    // Stash the old positions for transition.
    nodes.forEach(function(d) {
        d.x0 = d.x;
        d.y0 = d.y;
    });
    $("#loading").hide();
}


// Toggle children.
function toggle(d) {

    function set_dup(node) {
        node.type = 'duplicate';
        node._children = node.children;
        node.children = null;
    }

    function copy_original(node) {
        if (node.type == 'duplicate') {
            original = gdict[node.label];
            node.type = "copy";
            if (!original || !original._children) {
                console.log('ERR: NO ORIGINAL');
                console.log(node);
                return;
            }
            children = JSON.parse(JSON.stringify(original._children));
            children.forEach(set_dup);
            node.x_children = children == [] ? null : children;
        }
    }

    if (d.type == "duplicate") {
        copy_original(d);
        d.children = d.x_children;
    } else if (d.children) {
        d._children = d.children;
        d.children = null;
    } else {
        d.children = d._children;
        d._children = null;
    }
}

function get_ancestors(node, chain) {
    console.log(node.parent);
    if (node.parent){
        chain.push(node.parent);
        get_ancestors(node.parent,chain);
    }
}


// Retrieve url parameter values
function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}


init();
//$("#control").draggable();
