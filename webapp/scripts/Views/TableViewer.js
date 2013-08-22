define(["require", "DQX/Application", "DQX/Framework", "DQX/Controls", "DQX/Msg", "DQX/DocEl", "DQX/Utils", "DQX/SQL", "DQX/QueryTable", "DQX/QueryBuilder", "DQX/DataFetcher/DataFetchers", "MetaData"],
    function (require, Application, Framework, Controls, Msg, DocEl, DQX, SQL, QueryTable, QueryBuilder, DataFetchers, MetaData) {

        //A helper function, turning a fraction into a 3 digit text string
        var funcFraction2Text = function(vl) {
            if (vl==null)
                return '-'
            else
                return parseFloat(vl).toFixed(3);
        }

        //A helper function, turning a fraction into a color string
        var funcFraction2Color = function (vl) {
            if (vl == null)
                return "white";
            else {
                vl=parseFloat(vl);
                var vl = Math.abs(vl);
                vl = Math.min(1, vl);
                if (vl > 0) vl = 0.05 + vl * 0.95;
                vl = Math.sqrt(vl);
                var b = 255 ;
                var g = 255 * (1 - 0.3*vl * vl);
                var r = 255 * (1 - 0.6*vl);
                return "rgb(" + parseInt(r) + "," + parseInt(g) + "," + parseInt(b) + ")";
            }
        };




        var TableViewerModule = {

            init: function () {
                // Instantiate the view object
                var that = Application.View(
                    'tableviewer',  // View ID
                    'Table viewer'  // View title
                );

                //This function is called during the initialisation. Create the frame structure of the view here
                that.createFrames = function(rootFrame) {
                    rootFrame.makeGroupHor();//Declare the root frame as a horizontally divided set of subframes
                    this.frameQueriesContainer = rootFrame.addMemberFrame(Framework.FrameGroupTab('', 0.4));//Create frame that will contain the query panels
                    this.frameQueryAdvanced = this.frameQueriesContainer.addMemberFrame(Framework.FrameFinal('')).setAllowScrollBars(true,true)
                        .setDisplayTitle('Advanced query');//Create frame that will contain the query panels
                    this.frameQuerySimple = this.frameQueriesContainer.addMemberFrame(Framework.FrameFinal(''))
                        .setDisplayTitle('Simple query');//Create frame that will contain the query panels
                    this.frameTable = rootFrame.addMemberFrame(Framework.FrameFinal('', 0.6))//Create frame that will contain the table viewer
                        .setAllowScrollBars(false,true);
                }



                //This function is called during the initialisation. Create the panels that will populate the frames here
                that.createPanels = function() {

                    //Initialise the data fetcher that will download the data for the table
                    this.theTableFetcher = DataFetchers.Table(
                        MetaData.serverUrl,
                        MetaData.database,
                        'SNPCMB_'+MetaData.workspaceid
                    );
                    this.theTableFetcher.showDownload=true; //Allows the user to download the data in the table

                    this.createPanelTableViewer();


                    this.reLoad();

                    // Create the "simple query" panel
                    this.createPanelSimpleQuery();

                    //Make sure that the query results are reset each time another type of query is chosen
                    Msg.listen('',{ type: 'ChangeTab', id: this.frameQueriesContainer.getFrameID() }, function() {
                        that.panelTable.invalidateQuery();
                    });

                };

                that.onBecomeVisible = function() {
                    that.reLoad();
                }

                //Create the table viwer panel
                that.createPanelTableViewer = function () {
                    //Initialise the panel that will contain the table
                    this.panelTable = QueryTable.Panel(
                        this.frameTable,
                        this.theTableFetcher,
                        { leftfraction: 50 }
                    );
                    this.myTable = this.panelTable.getTable();// A shortcut variable

                    // Add a column for chromosome
                    var comp = that.myTable.createTableColumn(
                        QueryTable.Column("Chrom.","chrom",0),
                        "String",
                        false
                    );

                    // For the query tools, define this column as a multiple choice set
                    var chromPickList = [];
                    $.each(MetaData.chromosomes,function(idx,chrom) {
                        chromPickList.push({ id: idx+1, name: MetaData.chromosomes[idx].id });
                    })
                    //comp.setDataType_MultipleChoiceInt(chromPickList);

                };


                that.createPanelSimpleQuery = function () {
                    this.panelSimpleQuery = Framework.Form(this.frameQuerySimple);
                    this.panelSimpleQuery.setPadding(10);
                }

                that.reLoad = function() {

                    if (that.uptodate)
                        return;
                    that.uptodate = true;

                    this.theTableFetcher.resetAll();
                    that.myTable.clearTableColumns();

                    // Add a column for chromosome
                    var comp = that.myTable.createTableColumn(QueryTable.Column("Chrom.","chrom",0),"String",false);

                    // Add a column for position
                    var comp = that.myTable.createTableColumn(QueryTable.Column("Position.","pos",0),"IntB64",false);
                    that.myTable.addSortOption("Position", SQL.TableSort(['chrom', 'pos'])); // Define a joint sort action on both columns chrom+pos


                    // Add a column for the SNP identifier
                    var comp = that.myTable.createTableColumn(QueryTable.Column("SNP ID","snpid",1),"String",true);
                    comp.setToolTip('SNP identifier');  // Hover tooltip
                    comp.setCellClickHandler(function(fetcher,downloadrownr) {
                        var snpid=that.panelTable.getTable().getCellValue(downloadrownr,"snpid");
                        Msg.send({ type: 'SnpPopup' }, snpid);
                    })

                    //Add some  more columns
//                    that.myTable.createTableColumn(QueryTable.Column("Gene description","GeneDescription",1),"String",true);
                    that.myTable.createTableColumn(QueryTable.Column("Mut type","MutType",1),"String",true);
                    that.myTable.createTableColumn(QueryTable.Column("Mut name","MutName",1),"String",true);


                    //Create a column for each population frequency
                    $.each(MetaData.customSnpProperties,function(idx,propInfo) {
                        var col = that.myTable.createTableColumn(
                            QueryTable.Column(
                                propInfo.propid,       //Name of the column
                                propInfo.propid,       //Id of the column in the database table
                                1),               //Table part (1=right, scrolling)
                            "Float3",             //Transfer encoding: float encoded in 3 base64 characters
                            true                  // Column is sortable
                        );
                        //col.setToolTip(pop.name); //Provide a tool tip for the column
                        //Define a callback when the user clicks on a column
                        col.setHeaderClickHandler(function(id) {
                            alert('column clicked '+id);
                        })
                        col.CellToText = funcFraction2Text //Show the frequency value with a fixed 3 digit format
                        col.CellToColor = funcFraction2Color; //Create a background color that reflects the value
                    });

                    //we start by defining a query that returns everything
                    that.myTable.queryAll();

                    // Define an "advanced query" panel
                    this.panelTable.createPanelAdvancedQuery(this.frameQueryAdvanced);

                }



                return that;
            }

        };

        return TableViewerModule;
    });